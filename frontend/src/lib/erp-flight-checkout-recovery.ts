export type PendingErpFlightCheckout = {
  key: string;
  productIds: string[];
  passengerIds: number[];
  quoteVersion?: string;
};

export type ErpFlightCheckoutResult = {
  id: string;
  state: string;
  contractNumber: string | null;
  erpStatus: string | null;
  paymentEnabled: false;
  paymentMessage: string;
  retryable: boolean;
  message: string | null;
  errorCode?: string | null;
};

type RecoveryOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
  pollMilliseconds?: number;
  signal?: AbortSignal;
  onResult?: (result: ErpFlightCheckoutResult) => void;
};

export const erpCheckoutStorageKey = (customerId: number) =>
  `jahan-erp-flight-checkout:${customerId}`;

export function readPendingErpCheckout(
  storage: Pick<Storage, "getItem">,
  customerId: number,
): PendingErpFlightCheckout | null {
  try {
    const value = JSON.parse(
      storage.getItem(erpCheckoutStorageKey(customerId)) ?? "null",
    ) as unknown;
    if (!value || typeof value !== "object") return null;
    const pending = value as Partial<PendingErpFlightCheckout>;
    if (
      typeof pending.key !== "string" ||
      !Array.isArray(pending.productIds) ||
      !pending.productIds.every((item) => typeof item === "string") ||
      !Array.isArray(pending.passengerIds) ||
      !pending.passengerIds.every((item) => Number.isInteger(item))
    ) {
      return null;
    }
    return pending as PendingErpFlightCheckout;
  } catch {
    return null;
  }
}

export function savePendingErpCheckout(
  storage: Pick<Storage, "setItem">,
  customerId: number,
  pending: PendingErpFlightCheckout,
) {
  storage.setItem(erpCheckoutStorageKey(customerId), JSON.stringify(pending));
}

export function discardPendingErpCheckout(
  storage: Pick<Storage, "removeItem">,
  customerId: number,
) {
  storage.removeItem(erpCheckoutStorageKey(customerId));
}

export function pendingMatchesProducts(
  pending: PendingErpFlightCheckout,
  productIds: string[],
) {
  return (
    pending.productIds.length === productIds.length &&
    pending.productIds.every((productId, index) => productId === productIds[index])
  );
}

export function pendingCheckoutAction(
  pending: PendingErpFlightCheckout | null,
  productIds: string[],
): "new" | "resume" | "blocked" {
  if (!pending) return "new";
  return pendingMatchesProducts(pending, productIds) ? "resume" : "blocked";
}

export function checkoutRecoveryDisposition(
  result: ErpFlightCheckoutResult,
): "complete" | "continue" | "terminal" {
  if (result.state === "draft") return "complete";
  if (
    result.retryable ||
    ["received", "preparing", "prepared", "dispatching", "uncertain"].includes(
      result.state,
    )
  ) {
    return "continue";
  }
  return "terminal";
}

async function responseResult(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | ErpFlightCheckoutResult
    | null;
  return response.ok && body ? body : null;
}

export async function recoverPendingErpCheckout(
  pending: PendingErpFlightCheckout,
  options: RecoveryOptions,
): Promise<ErpFlightCheckoutResult | null> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const maxAttempts = options.maxAttempts ?? 20;
  const pollMilliseconds = options.pollMilliseconds ?? 2500;
  let latest: ErpFlightCheckoutResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options.signal?.aborted) return latest;
    const read = await fetcher(
      `${options.baseUrl}/account/erp-flight-checkouts/${pending.key}`,
      { credentials: "include", cache: "no-store", signal: options.signal },
    ).catch(() => null);
    if (!read) return latest;
    if (read.status !== 404) {
      latest = await responseResult(read);
      if (!latest) return null;
      options.onResult?.(latest);
      if (checkoutRecoveryDisposition(latest) !== "continue") return latest;
      await wait(pollMilliseconds);
    }
    if (options.signal?.aborted) return latest;
    const resumed = await fetcher(
      `${options.baseUrl}/account/erp-flight-checkouts`,
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        signal: options.signal,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": pending.key,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          productIds: pending.productIds,
          passengerIds: pending.passengerIds,
          quoteVersion: pending.quoteVersion,
        }),
      },
    ).catch(() => null);
    if (!resumed) continue;
    latest = await responseResult(resumed);
    if (!latest) return null;
    options.onResult?.(latest);
    if (checkoutRecoveryDisposition(latest) !== "continue") {
      return latest;
    }
    await wait(pollMilliseconds);
  }
  return latest;
}
