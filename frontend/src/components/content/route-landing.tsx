import { PageIntro } from "@/components/layout/page-intro";
import { PlaceholderGrid } from "@/components/content/placeholder-grid";

type RouteLandingProps = {
  eyebrow?: string;
  title: string;
  description: string;
  cards: ReadonlyArray<string>;
};

export function RouteLanding({
  eyebrow,
  title,
  description,
  cards,
}: RouteLandingProps) {
  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} description={description} />
      <PlaceholderGrid labels={cards} />
    </>
  );
}
