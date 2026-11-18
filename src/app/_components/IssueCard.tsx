"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

export type StoryWithAssignees = {
  id: string;
  name: string;
  description?: string | null;
  column: string;
  storyPoints?: number | null;
  sprintNumber?: string | null;
  assignees: Array<{
    userId: string;
    user?: { id: string; name: string; image?: string | null } | null;
  }>;
};

export type ViewMember = {
  userId: string;
  name: string;
  image?: string | null;
};

interface IssueCardProps {
  story: StoryWithAssignees;
  projectId: string;
  statusColumns: string[];
  members?: ViewMember[];
  sprintOptions?: string[];
  className?: string;
}

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

export function IssueCard({
  story,
  projectId,
  statusColumns,
  members = [],
  sprintOptions = [],
  className,
}: IssueCardProps) {
  const utils = api.useContext();
  const updateStory = api.story.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.story.list.invalidate({ projectId }),
        utils.story.getById.invalidate({ id: story.id }),
      ]);
    },
    onError: async (error) => {
      toast.error(error.message || "Could not update the issue");
      await Promise.all([
        utils.story.list.invalidate({ projectId }),
        utils.story.getById.invalidate({ id: story.id }),
      ]);
    },
  });

  const href = `/project/${encodeURIComponent(projectId)}/stories/${story.id}`;
  const currentColumnIndex = statusColumns.indexOf(story.column);
  const currentAssignees = useMemo(
    () => new Set(story.assignees.map((assignee) => assignee.userId)),
    [story.assignees],
  );
  const colInfo = COLUMN_LABELS[story.column] ?? {
    label: story.column,
    variant: "outline" as const,
  };
  const allSprints = [
    ...new Set(
      [...sprintOptions, story.sprintNumber].filter(
        (sprint): sprint is string => Boolean(sprint),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const setColumn = (column: string | undefined) => {
    if (column && column !== story.column) {
      updateStory.mutate({ id: story.id, column });
    }
  };

  const updateAssignee = (userId: string, checked: boolean) => {
    const nextAssignees = new Set(currentAssignees);
    if (checked) nextAssignees.add(userId);
    else nextAssignees.delete(userId);
    updateStory.mutate({ id: story.id, assigneeIds: [...nextAssignees] });
  };

  return (
    <Card
      className={cn(
        "hover:bg-muted/50 relative gap-2 p-3 transition-colors",
        className,
      )}
    >
      <Link
        href={href}
        aria-label={`Open issue: ${story.name}`}
        className="focus-visible:outline-ring absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-2"
      />
      <div className="pointer-events-none relative z-10 space-y-2">
        <p className="line-clamp-2 text-sm font-medium">{story.name}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={colInfo.variant} className="text-xs">
            {colInfo.label}
          </Badge>
          {story.storyPoints != null && story.storyPoints > 0 && (
            <Badge variant="outline" className="text-xs">
              {story.storyPoints} pts
            </Badge>
          )}
        </div>
        {story.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {story.assignees.slice(0, 4).map((assignee) => {
              const name = assignee.user?.name ?? "?";
              const initials = name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <Avatar
                  key={assignee.userId}
                  className="ring-background h-5 w-5 ring-2"
                >
                  {assignee.user?.image && (
                    <AvatarImage src={assignee.user.image} alt={name} />
                  )}
                  <AvatarFallback className="text-[9px]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              );
            })}
            {story.assignees.length > 4 && (
              <span className="text-muted-foreground pl-2 text-xs">
                +{story.assignees.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Move ${story.name} to previous status`}
          disabled={updateStory.isPending || currentColumnIndex <= 0}
          onClick={() => setColumn(statusColumns[currentColumnIndex - 1])}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Move ${story.name} to next status`}
          disabled={
            updateStory.isPending ||
            currentColumnIndex < 0 ||
            currentColumnIndex >= statusColumns.length - 1
          }
          onClick={() => setColumn(statusColumns[currentColumnIndex + 1])}
        >
          <ArrowRightIcon aria-hidden="true" />
        </Button>
        <label className="sr-only" htmlFor={`sprint-${story.id}`}>
          Sprint for {story.name}
        </label>
        <select
          id={`sprint-${story.id}`}
          className="bg-background h-7 max-w-28 rounded-md border px-1 text-xs"
          value={story.sprintNumber ?? ""}
          disabled={updateStory.isPending}
          onChange={(event) =>
            updateStory.mutate({
              id: story.id,
              sprintNumber: event.target.value || null,
            })
          }
        >
          <option value="">No sprint</option>
          {allSprints.map((sprint) => (
            <option key={sprint} value={sprint}>
              {sprint}
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
              {story.assignees.length > 0 && (
                <Button
                  className="mt-1 w-full"
                  variant="ghost"
                  size="sm"
                  disabled={updateStory.isPending}
                  onClick={() =>
                    updateStory.mutate({ id: story.id, assigneeIds: [] })
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
