import { requireAdmin } from "@/lib/admin";

import { DataTransferPanel } from "@/components/admin/data-transfer-panel";

export default async function DataTransferPage() {
  await requireAdmin();
  return <DataTransferPanel />;
}
