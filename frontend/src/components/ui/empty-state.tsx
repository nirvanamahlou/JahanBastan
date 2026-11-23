import type { ReactNode } from "react";

import { Card } from "./card";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <Card
      variant="soft"
      className={`flex min-h-64 flex-col items-center justify-center text-center ${className}`}
      role="status" aria-live="polite" aria-atomic="true"
    >
      {icon ? (
        <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-accent text-brand">
          {icon}
        </span>
      ) : null}
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-7 text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </Card>
  );
}
