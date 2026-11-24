import type { ReactNode } from "react";
import catalogStyles from "@/components/content/catalog-layout.module.css";
import { Container } from "@/components/ui/container";

type PageIntroProps = {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  compact?: boolean;
};

export function PageIntro({ eyebrow, title, description, compact = false }: PageIntroProps) {
  return (
    <section data-scroll-reveal className={`border-b border-border bg-surface-muted ${compact ? "py-7 sm:py-9" : "py-12 sm:py-16"}`}>
      <Container className={compact ? catalogStyles.catalogContainer : undefined}>
        {eyebrow ? (
          <p className="mb-3 text-sm font-bold text-brand">{eyebrow}</p>
        ) : null}
        <h1 className={`max-w-3xl font-black leading-tight ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`}>
          {title}
        </h1>
        {description ? (
          <p className={`max-w-2xl text-muted ${compact ? "mt-2 text-sm leading-7" : "mt-5 text-base leading-8 sm:text-lg"}`}>
            {description}
          </p>
        ) : null}
      </Container>
    </section>
  );
}
