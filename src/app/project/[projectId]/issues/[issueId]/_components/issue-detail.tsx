"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { CommentThread } from "@/app/_components/comment-thread";
import { Typography } from "@/app/_components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { projectHref } from "@/lib/project-navigation";
import { formatSprintLabel } from "@/lib/sprint";
import { api } from "@/trpc/react";

const formatStatus = (column: string) => {
  const label = column.replace(/[-_]+/g, " ").trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export function IssueDetail({
  projectId,
  issueId,
}: {
  projectId: string;
  issueId: string;
}) {
  const issue = api.story.getById.useQuery({ id: issueId }, { retry: false });
  const code = issue.error?.data?.code;
  // The issue must belong to the project in the URL.
  const wrongProject = issue.data && issue.data.projectId !== projectId;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href={projectHref(projectId)} />}
      >
        <ArrowLeftIcon aria-hidden />
        Back to board
      </Button>

      {issue.isPending ? (
        <div className="space-y-3" role="status" aria-label="Loading issue">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : issue.isError || wrongProject ? (
        <div role="alert" className="space-y-3">
          <Typography variant="h3" as="h1">
            {code === "FORBIDDEN"
              ? "You don't have access to this issue"
              : code === "NOT_FOUND" || wrongProject
                ? "Issue not found"
                : "We couldn't load this issue"}
          </Typography>
          <Typography variant="subtitle">
            {code === "FORBIDDEN"
              ? "You may no longer be a member of this project."
              : code === "NOT_FOUND" || wrongProject
                ? "It may have been deleted or moved."
                : "Check your connection and try again."}
          </Typography>
          {!wrongProject && code !== "FORBIDDEN" && code !== "NOT_FOUND" && (
            <Button
              variant="outline"
              disabled={issue.isFetching}
              onClick={() => void issue.refetch()}
            >
              Try again
            </Button>
          )}
        </div>
      ) : (
        <>
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">
                <span className="sr-only">Status: </span>
                {formatStatus(issue.data.column)}
              </Badge>
              {issue.data.sprintNumber && (
                <Badge variant="secondary">
                  {formatSprintLabel(issue.data.sprintNumber) ??
                    issue.data.sprintNumber}
                </Badge>
              )}
              {issue.data.storyPoints !== null && (
                <Badge variant="secondary">{issue.data.storyPoints} pts</Badge>
              )}
            </div>
            <Typography variant="h2" as="h1" className="break-words">
              {issue.data.name}
            </Typography>
            {issue.data.description && (
              <Typography className="break-words whitespace-pre-wrap">
                {issue.data.description}
              </Typography>
            )}
          </header>

          <CommentThread projectId={projectId} storyId={issueId} />
        </>
      )}
    </div>
  );
}
