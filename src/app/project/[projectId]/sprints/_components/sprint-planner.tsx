"use client";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  Loader2Icon,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { IssueCard } from "@/app/_components/issue-card";
import { Typography } from "@/app/_components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSprintLabel } from "@/lib/sprint";
import { api, type RouterOutputs } from "@/trpc/react";

type Story = RouterOutputs["story"]["list"][number];
type Sprint = RouterOutputs["sprint"]["listSprints"][number];

const RANGE_OPTIONS = [
  { value: "3-6", label: "3 past / 6 future", pastCount: 3, futureCount: 6 },
  { value: "6-12", label: "6 past / 12 future", pastCount: 6, futureCount: 12 },
  {
    value: "12-24",
    label: "12 past / 24 future",
    pastCount: 12,
    futureCount: 24,
  },
] as const;

const STATUS_COLUMNS = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

function isPastSprint(sprint: Sprint) {
  return sprint.endDate.getTime() <= Date.now();
}

function getSprintIssues(issues: Story[], sprintNumber: string) {
  return issues.filter((issue) => issue.sprintNumber === sprintNumber);
}

function getPoints(issues: Story[]) {
  return issues.reduce((total, issue) => total + (issue.storyPoints ?? 0), 0);
}

function IssueMoveControl({
  issue,
  sprints,
  onMove,
  disabled,
}: {
  issue: Story;
  sprints: Sprint[];
  onMove: (sprintNumber: string | null) => void;
  disabled: boolean;
}) {
  return (
    <Select
      value={issue.sprintNumber ?? "backlog"}
      onValueChange={(value) => onMove(value === "backlog" ? null : value)}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        className="w-full"
        aria-label={`Move ${issue.name} to a sprint`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="backlog">Backlog</SelectItem>
        {sprints.map((sprint) => (
          <SelectItem key={sprint.sprintNumber} value={sprint.sprintNumber}>
            {formatSprintLabel(sprint.sprintNumber) ?? sprint.sprintNumber}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PlannerIssue({
  issue,
  sprints,
  onMove,
  moving,
}: {
  issue: Story;
  sprints: Sprint[];
  onMove: (sprintNumber: string | null) => void;
  moving: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable={!moving}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", issue.id);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={dragging ? "opacity-50" : undefined}
    >
      <div className="mb-2 flex items-center gap-2">
        <GripVerticalIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
        <IssueMoveControl
          issue={issue}
          sprints={sprints}
          onMove={onMove}
          disabled={moving}
        />
      </div>
      <IssueCard issue={issue} showSprint={false} />
    </div>
  );
}

function StatusColumn({
  label,
  issues,
  sprints,
  onMove,
  movingId,
  dropTarget,
  onDrop,
}: {
  label: string;
  issues: Story[];
  sprints: Sprint[];
  onMove: (issue: Story, sprintNumber: string | null) => void;
  movingId: string | null;
  dropTarget: string | null;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDrop}
      className={`min-h-32 rounded-xl border border-dashed p-3 transition-colors ${
        dropTarget ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Typography variant="h6" as="h4">
          {label}
        </Typography>
        <Badge variant="secondary">{issues.length}</Badge>
      </div>
      <div className="space-y-3">
        {issues.length > 0 ? (
          issues.map((issue) => (
            <PlannerIssue
              key={issue.id}
              issue={issue}
              sprints={sprints}
              onMove={(sprintNumber) => onMove(issue, sprintNumber)}
              moving={movingId === issue.id}
            />
          ))
        ) : (
          <Typography variant="caption">Drop issues here</Typography>
        )}
      </div>
    </div>
  );
}

function SprintSection({
  sprint,
  issues,
  allSprints,
  current,
  movingId,
  onMove,
}: {
  sprint: Sprint;
  issues: Story[];
  allSprints: Sprint[];
  current: boolean;
  movingId: string | null;
  onMove: (issue: Story, sprintNumber: string | null) => void;
}) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const label = formatSprintLabel(sprint.sprintNumber) ?? sprint.sprintNumber;

  return (
    <section
      aria-labelledby={`sprint-${sprint.sprintNumber}`}
      className={current ? "scroll-mt-6" : "scroll-mt-6 opacity-75"}
    >
      {current && (
        <div className="text-primary mb-4 flex items-center gap-3">
          <div className="bg-primary/40 h-px flex-1" />
          <Typography variant="caption" as="span" className="font-semibold">
            Current sprint
          </Typography>
          <div className="bg-primary/40 h-px flex-1" />
        </div>
      )}
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Typography
                variant="h3"
                as="h2"
                id={`sprint-${sprint.sprintNumber}`}
              >
                {label}
              </Typography>
              <Typography variant="caption">
                {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
              </Typography>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{issues.length} issues</Badge>
              <Badge variant="secondary">{getPoints(issues)} points</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 overflow-x-auto pt-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_COLUMNS.map((column) => {
            const columnIssues = issues.filter(
              (issue) => issue.column === column.value,
            );
            const target = `${sprint.sprintNumber}:${column.value}`;
            return (
              <StatusColumn
                key={column.value}
                label={column.label}
                issues={columnIssues}
                sprints={allSprints}
                onMove={onMove}
                movingId={movingId}
                dropTarget={dropTarget === target ? target : null}
                onDrop={(event) => {
                  event.preventDefault();
                  const issueId = event.dataTransfer.getData("text/plain");
                  const issue = issues.find((item) => item.id === issueId);
                  setDropTarget(null);
                  if (issue) onMove(issue, sprint.sprintNumber);
                }}
              />
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

export function SprintPlanner() {
  const { projectId } = useParams<{ projectId: string }>();
  const [range, setRange] = useState("3-6");
  const [showPast, setShowPast] = useState(false);
  const [expandedPast, setExpandedPast] = useState<Set<string>>(new Set());
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const selectedRange =
    RANGE_OPTIONS.find((option) => option.value === range) ?? RANGE_OPTIONS[0];
  const rangeInput = {
    projectId,
    pastCount: selectedRange.pastCount,
    futureCount: selectedRange.futureCount,
  };
  const issuesQuery = api.story.list.useQuery({ projectId });
  const sprintsQuery = api.sprint.listSprints.useQuery(rangeInput);
  const currentQuery = api.sprint.getCurrentSprint.useQuery({ projectId });
  const utils = api.useUtils();
  const updateStory = api.story.update.useMutation();

  const sprints = useMemo(() => sprintsQuery.data ?? [], [sprintsQuery.data]);
  const issues = issuesQuery.data ?? [];
  const backlog = issues.filter((issue) => issue.sprintNumber === null);
  const currentSprintNumber = currentQuery.data?.sprintNumber;

  const hiddenPastCount = sprints.filter(isPastSprint).length;

  const moveIssue = async (issue: Story, sprintNumber: string | null) => {
    if (issue.sprintNumber === sprintNumber) return;
    setMovingId(issue.id);
    setMoveError(null);
    try {
      await updateStory.mutateAsync({ id: issue.id, sprintNumber });
      await Promise.all([
        utils.story.list.invalidate({ projectId }),
        utils.sprint.listSprints.invalidate(rangeInput),
      ]);
    } catch {
      setMoveError(`Could not move "${issue.name}". Please try again.`);
    } finally {
      setMovingId(null);
    }
  };

  if (
    issuesQuery.isLoading ||
    sprintsQuery.isLoading ||
    currentQuery.isLoading
  ) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (issuesQuery.isError || sprintsQuery.isError || currentQuery.isError) {
    return (
      <Card role="alert">
        <CardContent className="pt-6">
          <Typography variant="h4">Unable to load sprint planning</Typography>
          <Typography variant="caption">
            Refresh the page and try again.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (sprints.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <Typography variant="h1">Issues</Typography>
          <Typography variant="subtitle">
            Sprint planning is disabled for this project. All issues are shown
            below.
          </Typography>
        </div>
        {backlog.length === 0 ? (
          <Typography variant="caption">No issues yet.</Typography>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Typography variant="h1">Sprint planning</Typography>
          <Typography variant="subtitle">
            Organize work across the backlog and scheduled sprints.
          </Typography>
        </div>
        <div className="flex items-center gap-2">
          <Typography variant="caption" as="span">
            <label htmlFor="sprint-range">Range</label>
          </Typography>
          <Select
            value={range}
            onValueChange={(value) => {
              if (value) setRange(value);
            }}
          >
            <SelectTrigger id="sprint-range" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {moveError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
        >
          {moveError}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside
          aria-label="Backlog"
          className="space-y-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const issue = issues.find(
              (item) => item.id === event.dataTransfer.getData("text/plain"),
            );
            if (issue) void moveIssue(issue, null);
          }}
        >
          <div className="flex items-center justify-between">
            <Typography variant="h3" as="h2">
              Backlog
            </Typography>
            <Badge variant="secondary">{backlog.length}</Badge>
          </div>
          <Typography variant="caption">
            Issues without a sprint, including assigned issues.
          </Typography>
          {backlog.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Typography variant="caption">No backlog issues.</Typography>
              </CardContent>
            </Card>
          ) : (
            backlog.map((issue) => (
              <PlannerIssue
                key={issue.id}
                issue={issue}
                sprints={sprints}
                onMove={(sprintNumber) => void moveIssue(issue, sprintNumber)}
                moving={movingId === issue.id}
              />
            ))
          )}
        </aside>

        <div className="min-w-0 space-y-6">
          {hiddenPastCount > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPast((value) => !value)}
              aria-expanded={showPast}
            >
              {showPast ? <ChevronDownIcon /> : <ChevronRightIcon />}
              {showPast ? "Hide past sprints" : "Show past sprints"}
              <Badge variant="secondary">{hiddenPastCount}</Badge>
            </Button>
          )}
          {sprints.map((sprint) => {
            const past = isPastSprint(sprint);
            const expanded = expandedPast.has(sprint.sprintNumber);
            if (past && !showPast && !expanded) {
              return (
                <Button
                  key={sprint.sprintNumber}
                  type="button"
                  variant="ghost"
                  className="mb-2"
                  onClick={() =>
                    setExpandedPast((previous) => {
                      const next = new Set(previous);
                      next.add(sprint.sprintNumber);
                      return next;
                    })
                  }
                  aria-expanded={false}
                >
                  <ChevronRightIcon />
                  {formatSprintLabel(sprint.sprintNumber) ??
                    sprint.sprintNumber}
                </Button>
              );
            }
            return (
              <div key={sprint.sprintNumber}>
                {past && !showPast && expanded && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mb-2"
                    onClick={() =>
                      setExpandedPast((previous) => {
                        const next = new Set(previous);
                        next.delete(sprint.sprintNumber);
                        return next;
                      })
                    }
                    aria-expanded
                  >
                    <ChevronDownIcon />
                    {formatSprintLabel(sprint.sprintNumber) ??
                      sprint.sprintNumber}
                  </Button>
                )}
                <SprintSection
                  sprint={sprint}
                  issues={getSprintIssues(issues, sprint.sprintNumber)}
                  allSprints={sprints}
                  current={sprint.sprintNumber === currentSprintNumber}
                  movingId={movingId}
                  onMove={(issue, sprintNumber) =>
                    void moveIssue(issue, sprintNumber)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      {updateStory.isPending && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          Saving sprint assignment...
        </div>
      )}
    </div>
  );
}
