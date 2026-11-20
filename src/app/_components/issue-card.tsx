import { MessageSquare } from "lucide-react";
import Link from "next/link";

import { Typography } from "@/app/_components/typography";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatSprintLabel } from "@/lib/sprint";
import { type RouterOutputs } from "@/trpc/react";

type StoryListItem = RouterOutputs["story"]["list"][number];

/**
 * Data needed to render an issue card. Parents pass this from their list
 * query so cards never fetch assignees or comments on their own.
 */
export type IssueCardIssue = Pick<
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

type IssueCardProps = {
  issue: IssueCardIssue;
  showStoryPoints?: boolean;
  showSprint?: boolean;
};

const MAX_VISIBLE_ASSIGNEES = 3;

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
  showStoryPoints = true,
  showSprint = true,
}: IssueCardProps) {
  const sprintLabel =
    showSprint && issue.sprintNumber
      ? formatSprintLabel(issue.sprintNumber)
      : null;
  const description = issue.description?.replace(/\s+/g, " ").trim();
  const assignees = issue.assignees.map(({ user }) => user);
  const visibleAssignees = assignees.slice(0, MAX_VISIBLE_ASSIGNEES);
  const hiddenAssigneeCount = assignees.length - visibleAssignees.length;
  const commentLabel = `${issue.commentCount} ${
    issue.commentCount === 1 ? "comment" : "comments"
  }`;

  return (
    <Link
      href={`/project/${issue.projectId}/issues/${issue.id}`}
      className="focus-visible:ring-ring/50 block rounded-xl outline-none focus-visible:ring-3"
    >
      <Card size="sm" className="hover:ring-foreground/20 transition-colors">
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              <span className="sr-only">Status: </span>
              {formatStatus(issue.column)}
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
        <CardFooter className="justify-between gap-2">
          {visibleAssignees.length > 0 ? (
            // Don't overlap avatars: overlapping hides small initials. The
            // group's background-colored rings only make sense when avatars
            // overlap, so remove them to avoid a second circle on the card.
            <AvatarGroup className="space-x-0 *:data-[slot=avatar]:ring-0">
              <span className="sr-only">
                Assigned to{" "}
                {assignees
                  .map((user) => user.name || "Unknown user")
                  .join(", ")}
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
      </Card>
    </Link>
  );
}
