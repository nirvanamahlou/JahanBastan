import Link from "next/link";

type BreadcrumbItem = { label: string; href?: string };

type BreadcrumbProps = {
  items: ReadonlyArray<BreadcrumbItem>;
  variant?: "default" | "light";
};

export function Breadcrumb({ items, variant = "default" }: BreadcrumbProps) {
  const light = variant === "light";
  return (
    <nav aria-label="مسیر صفحه" className={light ? "text-white" : undefined}>
      <ol className={"flex flex-wrap items-center gap-2 text-sm " + (light ? "text-white/90" : "text-muted")}>
        {items.map((item, index) => (
          <li key={item.label + "-" + index} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className={light ? "text-white transition hover:text-white" : "hover:text-brand"}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className={light ? "font-bold text-white" : "font-bold text-foreground"}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}