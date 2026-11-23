const COMMENTABLE_SECTIONS = new Set([
  "articles",
  "destinations",
  "hotels",
  "services",
  "tours",
]);

export function normalizedPagePath(pathname: string) {
  if (pathname === "/") return pathname;
  return `${pathname.replace(/\/+$/, "")}/`;
}

export function isCommentablePage(pathname: string) {
  const segments = normalizedPagePath(pathname).split("/").filter(Boolean);
  return segments.length === 2 && COMMENTABLE_SECTIONS.has(segments[0]);
}
