"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Spinner } from "@/components/ui/spinner";
import { Typography } from "@/app/_components/typography";
import { BoardLayout } from "@/app/_components/BoardLayout";
import { IssueCard } from "@/app/_components/IssueCard";
import {
  getCurrentSprint,
  getSprintWindow,
} from "@/app/_components/sprint-utils";

const STATUSES = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

function compareSprints(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

export default function SprintsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const storiesQuery = api.story.list.useQuery({ projectId });
  const projectQuery = api.project.getById.useQuery({ projectId });
  const { data: members = [], error: membersError } = api.member.list.useQuery({
    projectId,
  });

  const stories = useMemo(() => storiesQuery.data ?? [], [storiesQuery.data]);
  const currentSprint = projectQuery.data
    ? getCurrentSprint(
        projectQuery.data.sprintStartDate,
        projectQuery.data.sprintDuration,
      )
    : null;
  const sprintWindow = useMemo(
    () =>
      projectQuery.data
        ? getSprintWindow(
            projectQuery.data.sprintStartDate,
            projectQuery.data.sprintDuration,
          )
        : [],
    [projectQuery.data],
  );
  const sprintColumns = useMemo(() => {
    const sprintNumbers = new Set(
      stories.flatMap((story) =>
        story.sprintNumber ? [story.sprintNumber] : [],
      ),
    );
    for (const sprint of sprintWindow) sprintNumbers.add(sprint);

    const sorted = [...sprintNumbers].sort(compareSprints);
    if (stories.some((story) => story.sprintNumber === null)) {
      sorted.push("__unscheduled__");
    }
    if (sorted.length === 0) sorted.push("__unscheduled__");

    return sorted.map((key) => {
      const isCurrent = key === currentSprint;
      const isPast =
        currentSprint !== null &&
        key !== "__unscheduled__" &&
        compareSprints(key, currentSprint) < 0;
      return {
        key,
        label:
          key === "__unscheduled__"
            ? "No sprint"
            : `${key}${isCurrent ? " (Current)" : isPast ? " (Past)" : ""}`,
        className: isCurrent
          ? "rounded-md bg-primary/5 ring-1 ring-primary/40"
          : isPast
            ? "opacity-75"
            : undefined,
      };
    });
  }, [currentSprint, sprintWindow, stories]);
  const statusRows = [
    ...STATUSES,
    ...[...new Set(stories.map((story) => story.column))]
      .filter((status) => !STATUSES.some((known) => known.key === status))
      .map((key) => ({ key, label: key })),
  ];

  if (storiesQuery.isLoading || projectQuery.isLoading) {
    return <Spinner className="mx-auto my-8" />;
  }

  const error = storiesQuery.error ?? projectQuery.error ?? membersError;
  if (error) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-4"
        role="alert"
      >
        <Typography variant="h3">Could not load sprint planning</Typography>
        <p className="mt-2 text-sm">{error.message}</p>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="space-y-3">
        <Typography variant="h1">Sprint Planning</Typography>
        <div className="py-12 text-center">
          <Typography variant="h3">No issues</Typography>
          <p className="text-muted-foreground mt-2">
            Issues assigned to sprints will appear here.
          </p>
        </div>
      </div>
    );
  }

  const sprintOptions = sprintColumns
    .map((column) => column.key)
    .filter((key) => key !== "__unscheduled__");

  return (
    <div className="space-y-4">
      <Typography variant="h1">Sprint Planning</Typography>
      <BoardLayout
        columns={sprintColumns}
        rows={statusRows}
        renderCell={(sprintKey, statusKey) => {
          const cell = stories.filter(
            (story) =>
              (story.sprintNumber ?? "__unscheduled__") === sprintKey &&
              story.column === statusKey,
          );
          if (cell.length === 0) {
            return (
              <div className="text-muted-foreground rounded border border-dashed p-2 text-center text-xs">
                Empty
              </div>
            );
          }
          return cell.map((story) => (
            <IssueCard
              key={story.id}
              story={story}
              projectId={projectId}
              statusColumns={statusRows.map((status) => status.key)}
              members={members}
              sprintOptions={sprintOptions}
            />
          ));
        }}
      />
    </div>
  );
}
