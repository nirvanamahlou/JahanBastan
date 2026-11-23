import { AdminSecurityPanel } from "@/components/admin/admin-security-panel";
import { requireAdmin } from "@/lib/admin";

export default async function AdminSecurityPage() {
  const { user } = await requireAdmin();
  return <AdminSecurityPanel username={user.email} />;
}
