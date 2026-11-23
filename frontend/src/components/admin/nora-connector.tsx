"use client";

import { useEffect, useState } from "react";

type Deployment = {
  ready: boolean;
  issues: string[];
  origin: string | null;
  apiBase: string;
};
const deploymentMessages: Record<string, string> = {
  PUBLIC_HTTPS_ORIGIN_REQUIRED:
    "نشانی عمومی HTTPS سایت روی سرور تنظیم نشده یا معتبر نیست.",
  DEPLOYED_ENVIRONMENT_REQUIRED:
    "حالت اجرای امن سرور برای اتصال تولید تنظیم نشده است.",
  PERSISTENT_ENCRYPTION_KEY_REQUIRED:
    "کلید ثابت نگهداری امن اتصال روی سرور آماده نیست.",
};

type Connection = {
  connectionId: string;
  state: string;
  version: number;
  createdAt: string;
  expiresAt: string;
  lastRenewedAt: string | null;
  resources: string[];
};

export function NoraConnector() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [noraOrigin, setNoraOrigin] = useState("https://avinaofficial.ir");
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const origin = deployment?.origin;
  const [bundle, setBundle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    connection: Connection;
    action: "disconnect" | "delete";
  } | null>(null);
  async function request(path: string, payload?: unknown) {
    const response = await fetch(`/api/admin-proxy/nora${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...(payload ? { method: "POST", body: JSON.stringify(payload) } : {}),
    });
    if (!response.ok)
      throw new Error(
        "عملیات اتصال انجام نشد؛ مجوز و تنظیمات امن سرور را بررسی کنید.",
      );
    return response.json();
  }
  async function load() {
    const data = await request("");
    setConnections(data.connections);
    setDeployment(data.deployment ?? null);
  }
  useEffect(() => {
    let cancelled = false;
    void request("")
      .then((data) => {
        if (!cancelled) {
          setConnections(data.connections);
          setDeployment(data.deployment ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("دریافت اتصال‌ها انجام نشد.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function perform(job: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await job();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "عملیات انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="min-w-0 space-y-4 rounded-2xl border border-line bg-white p-5"
      aria-label="اتصال به نورا"
    >
      <h2 className="text-xl font-black">اتصال به نورا</h2>
      <p>
        نشانی سایت:{" "}
        {origin ? (
          <span dir="ltr">{origin}</span>
        ) : (
          <span>نشانی عمومی معتبر تعریف نشده است</span>
        )}
      </p>
      {origin ? (
        <p>
          API:{" "}
          <span dir="ltr">
            {origin}
            {deployment?.apiBase}
          </span>
        </p>
      ) : null}
      {deployment?.ready ? (
        <p className="text-sm">
          تنظیمات سرور آماده است؛ موفقیت ارتباط فقط پس از آزمون اتصال در نورا
          تأیید می‌شود.
        </p>
      ) : (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-bold">
            تولید بسته تا تکمیل پیکربندی امن سرور غیرفعال است.
          </p>
          {deployment?.issues.map((issue) => (
            <p key={issue}>
              {deploymentMessages[issue] ??
                "پیکربندی اتصال روی سرور نیاز به بررسی دارد."}
            </p>
          ))}
          {!deployment ? <p>وضعیت پیکربندی سرور هنوز تأیید نشده است.</p> : null}
        </div>
      )}
      <p className="text-sm">
        هر کاربر با هویت مستقل نورا عمل می‌کند. مجوزهای کاربران در نورا مدیریت
        می‌شوند. مالی، قرارداد، رزرو و صدور از این اتصال غیرفعال‌اند.
      </p>
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
      <label className="block">
        نشانی نورا
        <input
          className="mt-2 w-full rounded-xl border p-3"
          dir="ltr"
          type="url"
          value={noraOrigin}
          disabled={busy}
          onChange={(event) => {
            setNoraOrigin(event.target.value);
            setBundle("");
          }}
        />
      </label>
      <button
        className="rounded-xl bg-brand px-4 py-3 text-white"
        disabled={busy || deployment?.ready !== true}
        onClick={() =>
          void perform(async () => {
            const value = await request("", { noraOrigin });
            setBundle(JSON.stringify(value));
            await load();
          })
        }
      >
        تولید بسته اتصال
      </button>
      {bundle ? (
        <div className="space-y-3 rounded-xl border p-4">
          <p>
            اطلاعات محرمانه فقط همین بار نمایش داده می‌شود. بسته را در
            یکپارچه‌سازی نورا، جهان باستان وارد کنید؛ سپس آزمون اتصال را اجرا
            کنید.
          </p>
          <textarea
            className="w-full rounded-xl border p-3"
            dir="ltr"
            readOnly
            value={bundle}
            rows={5}
            autoComplete="off"
          />
          <button
            className="rounded-xl border px-4 py-2"
            onClick={() =>
              void navigator.clipboard
                .writeText(bundle)
                .catch(() =>
                  setError(
                    "کپی خودکار انجام نشد؛ بسته را از کادر انتخاب و کپی کنید.",
                  ),
                )
            }
          >
            کپی بسته اتصال
          </button>
          <button
            className="mx-3 rounded-xl border px-4 py-2"
            onClick={() => setBundle("")}
          >
            بستن اطلاعات محرمانه
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] whitespace-nowrap text-right text-sm">
          <thead>
            <tr>
              <th>اتصال</th>
              <th>وضعیت</th>
              <th>ایجاد</th>
              <th>انقضا / آخرین تمدید</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((connection) => (
              <tr key={connection.connectionId}>
                <td className="p-2" dir="ltr">
                  {connection.connectionId.slice(0, 8)}
                  <details className="max-w-56 whitespace-normal" dir="rtl">
                    <summary>دسترسی‌های اتصال</summary>
                    <p dir="ltr">{connection.resources.join(" · ")}</p>
                  </details>
                </td>
                <td>{connection.state}</td>
                <td>
                  {new Date(connection.createdAt).toLocaleDateString("fa-IR")}
                </td>
                <td>
                  {new Date(connection.expiresAt).toLocaleDateString("fa-IR")} /{" "}
                  {connection.lastRenewedAt
                    ? new Date(connection.lastRenewedAt).toLocaleDateString(
                        "fa-IR",
                      )
                    : "—"}
                </td>
                <td>
                  <button
                    className="m-1 rounded border p-2"
                    disabled={busy || connection.state !== "ACTIVE"}
                    onClick={() =>
                      setConfirmation({ connection, action: "disconnect" })
                    }
                  >
                    قطع
                  </button>
                  <button
                    className="m-1 rounded border p-2"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({ connection, action: "delete" })
                    }
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirmation ? (
        <div
          role="alertdialog"
          aria-label="تأیید قطع اتصال"
          className="space-y-3 rounded-xl border p-4"
        >
          <p>
            کلید و دسترسی این اتصال باطل می‌شود. داده‌های تجاری و حسابرسی حفظ
            می‌شوند.
          </p>
          <button
            className="rounded border p-2"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await request(
                  `/${confirmation.connection.connectionId}/lifecycle`,
                  {
                    action: confirmation.action,
                    expectedVersion: confirmation.connection.version,
                    operationId: crypto.randomUUID(),
                  },
                );
                setBundle("");
                setConfirmation(null);
                await load();
              })
            }
          >
            تأیید
          </button>
          <button
            className="mx-3 rounded border p-2"
            disabled={busy}
            onClick={() => setConfirmation(null)}
          >
            انصراف
          </button>
        </div>
      ) : null}
    </section>
  );
}
