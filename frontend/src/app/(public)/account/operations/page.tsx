import type { Metadata } from "next";

import { CustomerOperationsPanel } from "@/components/customer-operations-panel";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "پیگیری درخواست‌ها" };

export default function CustomerOperationsPage() {
  return <section className="bg-surface-muted py-10 sm:py-16"><Container className="max-w-7xl"><CustomerOperationsPanel /></Container></section>;
}
