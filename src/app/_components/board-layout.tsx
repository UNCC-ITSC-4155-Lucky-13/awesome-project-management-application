"use client";

import type { ReactNode } from "react";
import { Typography } from "@/app/_components/typography";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  className?: string;
}

interface Row {
  key: string;
  label: string;
}

interface BoardLayoutProps {
  /** Column definitions (e.g. statuses like backlog / todo / in_progress / done). */
  columns: Column[];
  /**
   * Optional row groups (e.g. by assignee). When provided the board renders
   * a swimlane for each row. When omitted all items appear in a single grid.
   */
  rows?: Row[];
  /**
   * Render the cards for a given column × row intersection.
   * `rowKey` is undefined when no `rows` were supplied.
   */
  renderCell: (columnKey: string, rowKey: string | undefined) => ReactNode;
  className?: string;
}

/**
 * Reusable board grid that renders a horizontal set of columns with an
 * optional vertical swimlane dimension (rows).
 *
 * This component is intentionally layout-only – it has no data fetching or
 * mutation logic, making it easy to compose inside ViewRenderer or the
 * sprint-planning screen.
 *
 * Keyboard accessibility: column headings and row headings are rendered as
 * `<th>` / `<td>` elements inside a scroll-container so screen readers can
 * read the table structure. Cards inside each cell handle their own focus.
 */
export function BoardLayout({
  columns,
  rows,
  renderCell,
  className,
}: BoardLayoutProps) {
  if (!rows || rows.length === 0) {
    // Simple column-only layout
    return (
      <div
        className={cn("flex gap-4 overflow-x-auto pb-4", className)}
        role="region"
        aria-label="Board"
      >
        {columns.map((col) => (
          <section
            key={col.key}
            aria-label={col.label}
            className={cn(
              "flex min-w-[220px] flex-1 flex-col gap-2",
              col.className,
            )}
          >
            <Typography
              variant="h4"
              className="text-muted-foreground text-sm font-semibold tracking-wide uppercase"
            >
              {col.label}
            </Typography>
            <div className="flex flex-col gap-2">
              {renderCell(col.key, undefined)}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // Swimlane layout: rows × columns
  return (
    <div
      className={cn("overflow-x-auto", className)}
      role="region"
      aria-label="Board"
    >
      <table className="w-full border-separate border-spacing-2">
        <thead>
          <tr>
            {/* Row-label header cell */}
            <th className="w-32 text-left" />
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn("min-w-[200px] pb-2 text-left", col.className)}
              >
                <Typography
                  variant="h4"
                  className="text-muted-foreground text-sm font-semibold tracking-wide uppercase"
                >
                  {col.label}
                </Typography>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th
                scope="row"
                className="text-muted-foreground max-w-[120px] truncate pr-3 text-left align-top text-sm font-medium"
                title={row.label}
              >
                {row.label}
              </th>
              {columns.map((col) => (
                <td key={col.key} className="align-top">
                  <div className="flex flex-col gap-2">
                    {renderCell(col.key, row.key)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
