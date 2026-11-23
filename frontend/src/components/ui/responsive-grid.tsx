import type { ComponentPropsWithoutRef } from "react";

type GridColumns = 2 | 3 | 4;

const columnClasses: Record<GridColumns, string> = {
  2: "sm:grid-cols-2 sm:[&>*:only-child]:col-span-2",
  3: "sm:grid-cols-2 sm:[&>*:only-child]:col-span-2 lg:grid-cols-3 lg:[&>*:only-child]:col-span-3",
  4: "sm:grid-cols-2 sm:[&>*:only-child]:col-span-2 lg:grid-cols-4 lg:[&>*:only-child]:col-span-4",
};

type ResponsiveGridProps = ComponentPropsWithoutRef<"div"> & {
  columns?: GridColumns;
};

export function ResponsiveGrid({
  columns = 3,
  className = "",
  ...props
}: ResponsiveGridProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:gap-5 [&>*:only-child]:w-full [&>*:only-child]:max-w-md [&>*:only-child]:justify-self-center ${columnClasses[columns]} ${className}`}
      {...props}
    />
  );
}
