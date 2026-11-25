"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, MessageSquare } from "lucide-react";

import { Typography } from "@/app/_components/typography";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatSprintLabel } from "@/lib/sprint";
import { toast } from "@/components/ui/toast";
import { api, type RouterOutputs } from "@/trpc/react";
import { cn } from "@/lib/utils";

type StoryListItem = RouterOutputs["story"]["list"][number];

type IssueCardIssue = Pick<
  StoryListItem,
  | "id"
  | "projectId"
  | "name"
  | "description"
  | "column"
  | "storyPoints"
  | "sprintNumber"
  | "assignees"
  | "commentCount"
>;

type IssueCardMember = {
  userId: string;
  name: string;
  image?: string | null;
};

type IssueCardProps = {
  issue: IssueCardIssue;
  statusColumns?: string[];
  members?: IssueCardMember[];
  sprintOptions?: string[];
  showStoryPoints?: boolean;
  showSprint?: boolean;
  className?: string;
};

const DEFAULT_STATUS_COLUMNS = ["backlog", "todo", "in_progress", "done"];
const MAX_VISIBLE_ASSIGNEES = 3;

const COLUMN_LABELS: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  backlog: { label: "Backlog", variant: "secondary" },
  todo: { label: "To Do", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default" },
  done: { label: "Done", variant: "default" },
};

const formatStatus = (column: string) => {
  const label = column.replace(/[-_]+/g, " ").trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

export function IssueCard({
  issue,
  statusColumns = DEFAULT_STATUS_COLUMNS,
  members = [],
  sprintOptions = [],
  showStoryPoints = true,
  showSprint = true,
  className,
}: IssueCardProps) {
  const utils = api.useContext();
  const updateStory = api.story.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.story.list.invalidate({ projectId: issue.projectId }),
        utils.story.getById.invalidate({ id: issue.id }),
      ]);
    },
    onError: async (error) => {
      toast.add({
        type: "error",
        title: error.message || "Could not update the issue",
      });
      await Promise.all([
        utils.story.list.invalidate({ projectId: issue.projectId }),
        utils.story.getById.invalidate({ id: issue.id }),
      ]);
    },
  });

  const assignees = issue.assignees.map(({ user }) => user);
  const visibleAssignees = assignees.slice(0, MAX_VISIBLE_ASSIGNEES);
  const hiddenAssigneeCount = assignees.length - visibleAssignees.length;
  const commentLabel = `${issue.commentCount} ${
    issue.commentCount === 1 ? "comment" : "comments"
  }`;
  const sprintLabel =
    showSprint && issue.sprintNumber
      ? formatSprintLabel(issue.sprintNumber)
      : null;
  const description = issue.description?.replace(/\s+/g, " ").trim();
  const currentColumnIndex = statusColumns.indexOf(issue.column);
  const currentAssignees = useMemo(
    () => new Set(issue.assignees.map((assignee) => assignee.userId)),
    [issue.assignees],
  );
  const columnInfo = COLUMN_LABELS[issue.column] ?? {
    label: formatStatus(issue.column),
    variant: "outline" as const,
  };
  const allSprints = [
    ...new Set(
      [...sprintOptions, issue.sprintNumber].filter(
        (sprint): sprint is string => Boolean(sprint),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const setColumn = (column: string | undefined) => {
    if (column && column !== issue.column) {
      updateStory.mutate({ id: issue.id, column });
    }
  };

  const updateAssignee = (userId: string, checked: boolean) => {
    const nextAssignees = new Set(currentAssignees);
    if (checked) nextAssignees.add(userId);
    else nextAssignees.delete(userId);
    updateStory.mutate({ id: issue.id, assigneeIds: [...nextAssignees] });
  };

  return (
    <Card
      className={cn(
        "hover:bg-muted/50 relative gap-2 p-3 transition-colors",
        className,
      )}
    >
      <Link
        href={`/project/${encodeURIComponent(issue.projectId)}/issues/${issue.id}`}
        aria-label={`Open issue: ${issue.name}`}
        className="focus-visible:outline-ring absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-2"
      />
      <CardContent className="pointer-events-none relative z-10 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={columnInfo.variant}>
            <span className="sr-only">Status: </span>
            {columnInfo.label}
          </Badge>
          {sprintLabel && <Badge variant="secondary">{sprintLabel}</Badge>}
        </div>
        <Typography variant="h6" as="h3" className="line-clamp-2 break-words">
          {issue.name}
        </Typography>
        {description && (
          <Typography variant="caption" className="line-clamp-2 break-words">
            {description}
          </Typography>
        )}
      </CardContent>
      <CardFooter className="pointer-events-none relative z-10 justify-between gap-2">
        {visibleAssignees.length > 0 ? (
          <AvatarGroup className="space-x-0 *:data-[slot=avatar]:ring-0">
            <span className="sr-only">
              Assigned to{" "}
              {assignees.map((user) => user.name || "Unknown user").join(", ")}
            </span>
            {visibleAssignees.map((user) => (
              <Avatar key={user.id} size="sm" aria-hidden>
                {user.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            ))}
            {hiddenAssigneeCount > 0 && (
              <AvatarGroupCount aria-hidden className="ring-0">
                +{hiddenAssigneeCount}
              </AvatarGroupCount>
            )}
          </AvatarGroup>
        ) : (
          <Typography variant="caption" as="span">
            Unassigned
          </Typography>
        )}
        <div className="flex items-center gap-2">
          {showStoryPoints && issue.storyPoints !== null && (
            <Badge variant="secondary">{issue.storyPoints} pts</Badge>
          )}
          <Typography
            variant="caption"
            as="span"
            className="flex items-center gap-1"
          >
            <MessageSquare aria-hidden className="size-3.5" />
            <span aria-hidden>{issue.commentCount}</span>
            <span className="sr-only">{commentLabel}</span>
          </Typography>
        </div>
      </CardFooter>
      <div className="relative z-10 flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Move ${issue.name} to previous status`}
          disabled={updateStory.isPending || currentColumnIndex <= 0}
          onClick={() => setColumn(statusColumns[currentColumnIndex - 1])}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Move ${issue.name} to next status`}
          disabled={
            updateStory.isPending ||
            currentColumnIndex < 0 ||
            currentColumnIndex >= statusColumns.length - 1
          }
          onClick={() => setColumn(statusColumns[currentColumnIndex + 1])}
        >
          <ArrowRightIcon aria-hidden="true" />
        </Button>
        <label className="sr-only" htmlFor={`sprint-${issue.id}`}>
          Sprint for {issue.name}
        </label>
        <select
          id={`sprint-${issue.id}`}
          className="bg-background h-7 max-w-32 rounded-md border px-1 text-xs"
          value={issue.sprintNumber ?? ""}
          disabled={updateStory.isPending}
          onChange={(event) =>
            updateStory.mutate({
              id: issue.id,
              sprintNumber: event.target.value || null,
            })
          }
        >
          <option value="">No sprint</option>
          {allSprints.map((sprint) => (
            <option key={sprint} value={sprint}>
              {formatSprintLabel(sprint) ?? sprint}
            </option>
          ))}
        </select>
        {members.length > 0 && (
          <details className="relative">
            <summary className="focus-visible:outline-ring cursor-pointer rounded-md border px-2 py-1 text-xs focus-visible:outline-2">
              Assignees
            </summary>
            <fieldset className="bg-popover text-popover-foreground relative z-20 mt-1 max-h-48 min-w-40 overflow-auto rounded-md border p-2 shadow-md">
              <legend className="px-1 text-xs font-medium">
                Assign people
              </legend>
              {members.map((member) => (
                <label
                  key={member.userId}
                  className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={currentAssignees.has(member.userId)}
                    disabled={updateStory.isPending}
                    onChange={(event) =>
                      updateAssignee(member.userId, event.target.checked)
                    }
                  />
                  {member.name}
                </label>
              ))}
              {issue.assignees.length > 0 && (
                <Button
                  type="button"
                  className="mt-1 w-full"
                  variant="ghost"
                  size="sm"
                  disabled={updateStory.isPending}
                  onClick={() =>
                    updateStory.mutate({ id: issue.id, assigneeIds: [] })
                  }
                >
                  Clear assignees
                </Button>
              )}
            </fieldset>
          </details>
        )}
      </div>
    </Card>
  );
}
