"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const revealSelector = ["[data-scroll-reveal]", "main > section", "main article"].join(",");

export function ScrollRevealController() {
  const pathname = usePathname();

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(revealSelector))
      .filter((element) => !element.closest("[data-scroll-reveal-skip]") && !element.querySelector(revealSelector));
    if (!elements.length) return;

    const shouldRevealImmediately =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 47.99rem)").matches ||
      !("IntersectionObserver" in window);
    if (shouldRevealImmediately) {
      elements.forEach((element) => {
        element.classList.remove("scroll-reveal-pending", "scroll-revealed", "scroll-reveal-from-top", "scroll-reveal-from-bottom");
        element.style.removeProperty("--scroll-reveal-delay");
      });
      return;
    }

    const frameIds = new Map<HTMLElement, number>();
    const revealed = new Set<HTMLElement>();

    elements.forEach((element, index) => {
      element.classList.remove("scroll-revealed", "scroll-reveal-from-top", "scroll-reveal-from-bottom");
      element.classList.add("scroll-reveal-pending");
      element.style.setProperty("--scroll-reveal-delay", String(Math.min(index % 4, 3) * 70) + "ms");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          if (!entry.isIntersecting || revealed.has(element)) return;
          // Animation transforms can cross the observer boundary themselves.
          // Stop observing before animating so visible content never hides again.
          revealed.add(element);
          observer.unobserve(element);

          const directionClass = entry.boundingClientRect.top < 0
            ? "scroll-reveal-from-top"
            : "scroll-reveal-from-bottom";
          element.classList.remove("scroll-revealed", "scroll-reveal-from-top", "scroll-reveal-from-bottom");
          element.classList.add("scroll-reveal-pending", directionClass);

          const frameId = window.requestAnimationFrame(() => {
            frameIds.delete(element);
            element.classList.remove("scroll-reveal-pending");
            element.classList.add("scroll-revealed");
          });
          frameIds.set(element, frameId);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => {
      frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
      observer.disconnect();
      elements.forEach((element) => {
        element.classList.remove("scroll-reveal-pending", "scroll-revealed", "scroll-reveal-from-top", "scroll-reveal-from-bottom");
        element.style.removeProperty("--scroll-reveal-delay");
      });
    };
  }, [pathname]);

  return null;
}
