import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

type PageIntroProps = {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
};

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <section data-scroll-reveal className="border-b border-border bg-surface-muted py-12 sm:py-16">
      <Container>
        {eyebrow ? (
          <p className="mb-3 text-sm font-bold text-brand">{eyebrow}</p>
        ) : null}
        <h1 className="max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted sm:text-lg">
            {description}
          </p>
        ) : null}
      </Container>
    </section>
  );
}
