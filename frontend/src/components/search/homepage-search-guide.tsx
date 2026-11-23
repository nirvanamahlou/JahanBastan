"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { RichText } from "@/components/content/rich-text";
import styles from "./homepage-search-guide.module.css";
import { Container } from "@/components/ui/container";
import type { ServiceType } from "@/components/search/travel-search";
import { searchGuides } from "@/lib/search-guides";

const SearchServiceContext = createContext<{
  serviceType: ServiceType;
  setServiceType: (service: ServiceType) => void;
} | null>(null);

export function HomepageSearchProvider({ children }: { children: ReactNode }) {
  const [serviceType, setServiceType] = useState<ServiceType>("tour");
  const value = useMemo(() => ({ serviceType, setServiceType }), [serviceType]);
  return <SearchServiceContext.Provider value={value}>{children}</SearchServiceContext.Provider>;
}

export function useHomepageSearchService() {
  const context = useContext(SearchServiceContext);
  if (!context) throw new Error("Homepage search requires its provider");
  return context;
}

export function HomepageSearchGuide({ content }: { content: Record<string, string> }) {
  const { serviceType } = useHomepageSearchService();
  const guide = searchGuides.find((item) => item.service === serviceType)!;
  const body = (content[guide.key] ?? guide.text).trim();
  if (!body) return null;
  const parts = body.replace(/\r\n/g, "\n").split(/\n### /);
  const introduction = parts.shift() || "";
  const heading = introduction.match(/^## ([^\n]+)/)?.[1] || `راهنمای ${guide.label}`;
  const introBody = introduction.replace(/^## [^\n]+\n*/, "").trim();
  const group = `home-search-guide-${serviceType}`;

  return (
    <section className={styles.section} aria-labelledby="home-search-guide-title" data-search-guide={serviceType} dir="rtl">
      <Container className={styles.layout}>
        <header className={styles.header}>
          <h2 id="home-search-guide-title">{heading}</h2>
          <a href="/contact/">از کارشناس سفر بپرسید <span aria-hidden="true">←</span></a>
        </header>
        {(parts.length > 0 || introBody) && (
          <div className={styles.entries} key={serviceType}>
            {introBody && <GuideEntry group={group} title="دربارهٔ این راهنما" content={introBody} />}
            {parts.map((part, index) => {
              const firstLine = part.indexOf("\n");
              const title = firstLine < 0 ? part : part.slice(0, firstLine);
              return (
                <GuideEntry
                  key={index}
                  group={group}
                  title={title}
                  content={firstLine < 0 ? "" : part.slice(firstLine).trim()}
                />
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}

function GuideEntry({ group, title, content }: { group: string; title: string; content: string }) {
  return (
    <details name={group} className={styles.entry}>
      <summary>{title}</summary>
      <RichText className={styles.answer} content={content} />
    </details>
  );
}
