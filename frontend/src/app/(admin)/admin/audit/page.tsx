import { AdminAuditPanel } from "@/components/admin/admin-audit-panel";
import { adminFetch, requireAdmin } from "@/lib/admin";

interface AuditEvent {
  id: number;
  source: "cart" | "booking" | "lead";
  entityType: "cart" | "booking" | "lead";
  entityId: number;
  actorName: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  occurredAt: string;
}

interface LoginEvent {
  id: number;
  adminUserId: number;
  actorName: string;
  email: string;
  role: "super_admin" | "admin" | "editor";
  status: "active" | "expired" | "revoked";
  loggedInAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
}

export default async function AuditPage() {
  const { user, cookieHeader } = await requireAdmin();
  if (user.role !== "super_admin") return <p>دسترسی به سوابق مدیریتی ندارید.</p>;

  const [eventsResponse, loginsResponse] = await Promise.all([
    adminFetch("/admin/audit/events?pageSize=60", {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }),
    adminFetch("/admin/audit/logins?pageSize=60", {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }),
  ]);
  const eventsPayload = eventsResponse.ok
    ? ((await eventsResponse.json()) as { items: AuditEvent[] })
    : { items: [] };
  const loginsPayload = loginsResponse.ok
    ? ((await loginsResponse.json()) as { items: LoginEvent[] })
    : { items: [] };

  return (
    <AdminAuditPanel
      initialEvents={eventsPayload.items}
      initialLogins={loginsPayload.items}
    />
  );
}
