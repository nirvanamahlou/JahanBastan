import { OperationsManager } from "@/components/admin/operations-manager";
import { requireAdmin } from "@/lib/admin";

export default async function OperationsPage() {
  const { user } = await requireAdmin();
  if (!['super_admin', 'admin'].includes(user.role)) return <p>دسترسی مدیریت عملیات ندارید.</p>;
  return <OperationsManager />;
}
