import type { ReactNode } from "react";

type Column<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
};

type AdminTableProps<Row> = {
  caption: string;
  columns: ReadonlyArray<Column<Row>>;
  rows: ReadonlyArray<Row>;
  getRowKey: (row: Row) => string | number;
};

export function AdminTable<Row>({ caption, columns, rows, getRowKey }: AdminTableProps<Row>) {
  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-surface [scrollbar-width:thin]">
      <table className="w-full min-w-[42rem] text-right text-sm">
        <caption className="border-b border-border p-4 text-right text-lg font-black sm:p-5 sm:text-xl">{caption}</caption>
        <thead className="bg-surface-muted">
          <tr>{columns.map((column) => <th scope="col" className="p-3" key={column.key}>{column.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-border" key={getRowKey(row)}>
              {columns.map((column) => <td className="p-3 align-top" key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
