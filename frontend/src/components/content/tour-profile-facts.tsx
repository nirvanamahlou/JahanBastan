import type { ReactNode } from "react";
import tourStyles from "./structured-tour-content.module.css";

type Fact = { label: string; value: ReactNode; icon: ReactNode; detail?: ReactNode };
export function TourProfileFacts({ facts }: { facts: Fact[] }) {
  return (
        <section aria-label="اطلاعات کلیدی تور" className={`grid gap-3 rounded-3xl border p-4 sm:grid-cols-2 lg:grid-cols-4 ${tourStyles.factsPanel}`}>
          {facts.map((fact) => (
            <div className={tourStyles.factCard} key={fact.label}>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={tourStyles.factIcon}>{fact.icon}</span>
                <div>
                  <p className="text-xs text-muted">{fact.label}</p>
                  <strong className="mt-1 block text-sm">{fact.value}</strong>
                  {fact.detail ? <p className="mt-1 text-xs text-muted">{fact.detail}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </section>
  );
}
