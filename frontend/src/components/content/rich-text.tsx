import Image from "next/image";
import type { ReactNode } from "react";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";

type Props = { content: string; className?: string };

function inline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((?:https?:\/\/|\/)[^)]+\))/g;
  return text.split(pattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)]+)\)$/);
    if (link) return <a className="font-bold text-brand underline underline-offset-4" href={link[2]} key={index} rel={link[2].startsWith("http") ? "noopener noreferrer" : undefined}>{link[1]}</a>;
    return part;
  });
}

export function RichText({ content, className = "" }: Props) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    const image = line.match(/^!\[([^\]]*)\]\(media:(\d+)\)$/);
    if (image) {
      blocks.push(<figure className="relative my-6 aspect-square w-full overflow-hidden rounded-2xl bg-surface-muted" key={index}><Image alt={image[1]} className="object-cover" fill sizes="(max-width: 768px) 100vw, 800px" src={`${PUBLIC_API_BASE_URL}/media/${image[2]}`} /></figure>);
      index += 1; continue;
    }
    if (line.startsWith("### ")) { blocks.push(<h3 className="mt-7 text-xl font-black" key={index}>{inline(line.slice(4))}</h3>); index += 1; continue; }
    if (line.startsWith("## ")) { blocks.push(<h2 className="mt-9 text-2xl font-black sm:text-3xl" key={index}>{inline(line.slice(3))}</h2>); index += 1; continue; }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*] /.test(lines[index].trim())) { items.push(lines[index].trim().slice(2)); index += 1; }
      blocks.push(<ul className="my-4 list-disc space-y-2 pr-6 leading-8" key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ul>); continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\. /.test(lines[index].trim())) { items.push(lines[index].trim().replace(/^\d+\. /, "")); index += 1; }
      blocks.push(<ol className="my-4 list-decimal space-y-2 pr-6 leading-8" key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</ol>); continue;
    }
    if (line.startsWith("> ")) { blocks.push(<blockquote className="my-5 border-r-4 border-brand bg-surface-muted p-4 leading-8" key={index}>{inline(line.slice(2))}</blockquote>); index += 1; continue; }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(## |### |[-*] |\d+\. |> |!\[[^\]]*\]\(media:\d+\)$)/.test(lines[index].trim())) { paragraph.push(lines[index].trim()); index += 1; }
    blocks.push(<p className="my-4 leading-9 text-muted" key={`p-${index}`}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className={className}>{blocks}</div>;
}
