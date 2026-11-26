import { redirect } from "next/navigation";

export default async function LegacyCartPage({ searchParams }: { searchParams: Promise<{ passengerFlow?: string; flight?: string; guest?: string }> }) {
  const params = await searchParams;
  redirect(params.passengerFlow || params.flight ? "/account/?tab=tickets" : params.guest ? "/tours/resume/" : "/account/?tab=trips");
}
