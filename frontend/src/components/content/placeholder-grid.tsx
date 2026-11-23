import { Container } from "@/components/ui/container";

type PlaceholderGridProps = {
  labels: ReadonlyArray<string>;
};

export function PlaceholderGrid({ labels }: PlaceholderGridProps) {
  return (
    <Container className="grid gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
      {labels.map((label) => (
        <article
          key={label}
          className="min-h-40 rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <div className="h-2 w-12 rounded-full bg-accent" />
          <h2 className="mt-6 text-xl font-black">{label}</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            این بخش برای اتصال به API و نمایش محتوای مدیریت‌شده آماده است.
          </p>
        </article>
      ))}
    </Container>
  );
}
