import catalogStyles from "@/components/content/catalog-layout.module.css";
import { Container } from "@/components/ui/container";
import { TourCardSkeleton } from "@/components/content/tour-card-skeleton";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";

export default function ToursLoading() {
  return (
    <Container className={`${catalogStyles.catalogContainer} py-8`}>
      <div
        className="grid items-start gap-7 lg:grid-cols-[18rem_minmax(0,1fr)]"
        role="status" aria-live="polite" aria-atomic="true"
        aria-label="در حال بارگذاری تورها"
      >
        <div
          className="hidden h-[34rem] animate-pulse rounded-2xl bg-surface-muted lg:block"
          aria-hidden="true"
        />
        <div>
          <div
            className="mb-7 h-10 w-56 animate-pulse rounded-xl bg-surface-muted"
            aria-hidden="true"
          />
          <ResponsiveGrid>
            {Array.from({ length: 6 }, (_, index) => (
              <TourCardSkeleton key={index} />
            ))}
          </ResponsiveGrid>
        </div>
        <span className="sr-only">در حال بارگذاری تورها</span>
      </div>
    </Container>
  );
}
