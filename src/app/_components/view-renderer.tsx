"use client";

import { useCallback, useMemo } from "react";
import { api } from "@/trpc/react";
import { Spinner } from "@/components/ui/spinner";
import { Typography } from "@/app/_components/typography";
import { BoardLayout } from "@/app/_components/BoardLayout";
import { IssueCard } from "@/app/_components/issue-card";
import type { RouterOutputs } from "@/trpc/react";
import type { ViewConfiguration, ViewIssueField } from "@/server/db/schema";

const DEFAULT_COLUMNS = ["backlog", "todo", "in_progress", "done"];
const COLUMN_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

function columnLabel(key: string) {
  return COLUMN_LABELS[key] ?? key;
}

type Story = RouterOutputs["story"]["list"][number];

function assigneeKey(story: Story) {
  if (story.assignees.length === 0) return "__none__";
  return story.assignees
    .map((assignee) => assignee.userId)
    .sort()
    .join(",");
}

function assigneeLabel(story: Story) {
  if (story.assignees.length === 0) return "No assignee";
  return [...story.assignees]
    .sort((a, b) => a.userId.localeCompare(b.userId))
    .map((assignee) => assignee.user?.name ?? assignee.userId)
    .join(", ");
}

function dimensionKey(story: Story, field: ViewIssueField) {
  if (field === "assignee") return assigneeKey(story);
  if (field === "sprint") return story.sprintNumber ?? "__unscheduled__";
  return story.column;
}

function dimensionLabel(story: Story, field: ViewIssueField, key: string) {
  if (field === "assignee") return assigneeLabel(story);
  if (field === "sprint") {
    return key === "__unscheduled__" ? "No sprint" : key;
  }
  return columnLabel(key);
}

export function ViewRenderer({
  projectId,
  configuration,
}: {
  projectId: string;
  configuration: ViewConfiguration;
}) {
  const {
    data: stories,
    isLoading,
    error,
  } = api.story.list.useQuery(
    useMemo(() => {
      const params: Parameters<typeof api.story.list.useQuery>[0] = {
        projectId,
      };
      const filters = configuration.filters;
      if (filters?.sprintNumber) params.sprintNumber = filters.sprintNumber;
      if (filters?.assigneeId !== undefined) {
        params.assigneeId = filters.assigneeId;
      }
      const column =
        filters?.column !== undefined ? filters.column : filters?.status;
      if (column) params.column = column;

      const sort = configuration.sort;
      if (typeof sort === "string") {
        params.sort = sort;
      } else if (sort) {
        params.sort = sort.field;
        params.sortDirection = sort.direction;
      }
      return params;
    }, [projectId, configuration]),
  );
  const { data: members = [], error: membersError } = api.member.list.useQuery({
    projectId,
  });
  const {
    data: sprints = [],
    isLoading: sprintsLoading,
    error: sprintsError,
  } = api.sprint.listSprints.useQuery({ projectId });

  const storyList = useMemo(() => stories ?? [], [stories]);
  const grouping =
    configuration.grouping?.column ?? configuration.groupBy ?? "status";
  const rowSplit =
    configuration.grouping?.row !== undefined
      ? configuration.grouping.row
      : configuration.rowSplit !== undefined
        ? configuration.rowSplit
        : (configuration.rowGroup ?? null);
  const configuredColumns =
    configuration.columns && configuration.columns.length > 0
      ? configuration.columns
      : DEFAULT_COLUMNS;

  const columnDefinitions = useMemo(() => {
    if (grouping === "status") {
      return configuredColumns.map((key) => ({
        key,
        label: columnLabel(key),
      }));
    }

    const labels = new Map<string, string>();
    for (const story of storyList) {
      const key = dimensionKey(story, grouping);
      if (!labels.has(key)) {
        labels.set(key, dimensionLabel(story, grouping, key));
      }
    }
    const entries = [...labels.entries()].sort(([a], [b]) => {
      if (a === "__none__" || a === "__unscheduled__") return 1;
      if (b === "__none__" || b === "__unscheduled__") return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    return entries.map(([key, label]) => ({ key, label }));
  }, [configuredColumns, grouping, storyList]);

  const rows = useMemo(() => {
    if (!rowSplit) return undefined;
    const labels = new Map<string, string>();
    for (const story of storyList) {
      const key = dimensionKey(story, rowSplit);
      if (!labels.has(key)) {
        labels.set(key, dimensionLabel(story, rowSplit, key));
      }
    }
    return [...labels.entries()]
      .sort(([a], [b]) => {
        if (a === "__none__" || a === "__unscheduled__") return 1;
        if (b === "__none__" || b === "__unscheduled__") return -1;
        return a.localeCompare(b, undefined, { numeric: true });
      })
      .map(([key, label]) => ({ key, label }));
  }, [rowSplit, storyList]);

  const statusColumns =
    grouping === "status" ? configuredColumns : DEFAULT_COLUMNS;
  const sprintOptions = useMemo(
    () => [
      ...new Set([
        ...storyList.flatMap((story) =>
          story.sprintNumber ? [story.sprintNumber] : [],
        ),
        ...sprints.map((sprint) => sprint.sprintNumber),
      ]),
    ],
    [sprints, storyList],
  );

  const renderCell = useCallback(
    (columnKey: string, rowKey: string | undefined) => {
      const cell = storyList.filter((story) => {
        if (dimensionKey(story, grouping) !== columnKey) return false;
        if (rowKey === undefined) return true;
        return (
          rowSplit !== null &&
          rowSplit !== undefined &&
          dimensionKey(story, rowSplit) === rowKey
        );
      });

      if (cell.length === 0) {
        return (
          <div className="text-muted-foreground border-muted-foreground/20 rounded border border-dashed p-2 text-center text-xs">
            Empty
          </div>
        );
      }

      return cell.map((story) => (
        <IssueCard
          key={story.id}
          issue={story}
          statusColumns={statusColumns}
          members={members}
          sprintOptions={sprintOptions}
        />
      ));
    },
    [grouping, members, rowSplit, sprintOptions, statusColumns, storyList],
  );

  if (isLoading || sprintsLoading) {
    return <Spinner className="mx-auto my-8" />;
  }

  if (error || membersError || sprintsError) {
    const message =
      error?.message ?? membersError?.message ?? sprintsError?.message;
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-4"
        role="alert"
      >
        <Typography variant="h4">Could not load this view</Typography>
        <p className="mt-1 text-sm">{message}</p>
      </div>
    );
  }

  if (storyList.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
        <Typography variant="h3">No issues</Typography>
        <p className="mt-2 text-sm">
          No issues match this view&apos;s configuration.
        </p>
      </div>
    );
  }

  return (
    <BoardLayout
      columns={columnDefinitions}
      rows={rows}
      renderCell={renderCell}
      className="min-h-0"
    />
  );
}
