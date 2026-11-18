import { useMemo } from "react";
import { api } from "@/trpc/react";
import { Card } from "@/components/ui/card"; // reuse existing issue card styling
import { Spinner } from "@/components/ui/spinner";
import { Typography } from "@/app/_components/typography";

/**
 * Renders a saved view based on its configuration.
 * - `columns` are displayed as sections.
 * - `rowSplit` (optional) groups items vertically.
 * - `filters` and `sort` are passed to the story.list query.
 *
 * This is a minimal implementation – the UI can be enhanced later.
 */
export function ViewRenderer({
  projectId,
  viewId,
  configuration,
}: {
  projectId: string;
  viewId: string;
  configuration: any; // ViewConfiguration type from the DB (runtime validation occurs on the server)
}) {
  // Build query parameters from configuration
  const queryParams = useMemo(() => {
    const params: any = { projectId };
    if (configuration?.filters) params.filters = configuration.filters;
    if (configuration?.sort) params.sort = configuration.sort;
    return params;
  }, [projectId, configuration]);

  const { data: stories, isLoading, error } = api.story.list.useQuery(queryParams);

  if (isLoading) return <Spinner className="mx-auto my-8" />;
  if (error) return <div className="p-4 text-red-600">Error loading stories: {error.message}</div>;
  if (!stories?.length)
    return (
      <div className="p-4 text-gray-500">
        <Typography variant="p">No issues match the view configuration.</Typography>
      </div>
    );

  // Helper to filter stories for a given column key (status, assignee, sprint, etc.)
  const filterByColumn = (column: string) => {
    if (!configuration?.groupBy) return stories;
    // Example: if grouping by status, column is a status value
    return stories.filter((s: any) => {
      const field = configuration.groupBy as keyof typeof s;
      return String(s[field] ?? "").toLowerCase() === column.toLowerCase();
    });
  };

  // Determine columns – if not provided, fallback to a single "All" column
  const columns = configuration?.columns?.length ? configuration.columns : ["All"];

  return (
    <div className="space-y-8">
      {columns.map((col: string) => {
        const items = filterByColumn(col);
        return (
          <div key={col}>
            <Typography variant="h3" className="mb-4">
              {col}
            </Typography>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((story: any) => (
                <Card key={story.id} className="p-4 cursor-pointer hover:bg-muted/50 transition">
                  <Typography variant="h4" className="text-sm font-medium line-clamp-2">
                    {story.title}
                  </Typography>
                  {/* Display a few useful fields – you can expand as needed */}
                  <div className="mt-2 text-xs text-gray-500">
                    {story.status && <span>Status: {story.status}</span>}
                    {story.assignee && <span className="ml-2">Assignee: {story.assignee.name ?? story.assignee}</span>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
