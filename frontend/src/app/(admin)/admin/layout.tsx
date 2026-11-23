import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
