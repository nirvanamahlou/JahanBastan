import { BookIcon } from "@/components/layout/site-icons";

export function TransportGuide({
  content,
  title,
}: {
  content: string | undefined;
  title: string;
}) {
  if (!content?.trim()) return null;

  return (
    <section className="mt-8 rounded-3xl border border-brand/15 bg-brand-soft/40 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-brand">
        <span className="grid size-10 place-items-center rounded-xl bg-white shadow-sm">
          <BookIcon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-black">راهنمای سفر</p>
          <h2 className="mt-0.5 text-xl font-black">{title}</h2>
        </div>
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-8 text-foreground/85">{content}</p>
    </section>
  );
}
