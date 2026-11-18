"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Typography } from "@/app/_components/typography";

export default function StoryPage() {
  const { projectId, storyId } = useParams<{
    projectId: string;
    storyId: string;
  }>();
  const {
    data: story,
    isLoading,
    error,
  } = api.story.getById.useQuery({
    id: storyId,
    projectId,
  });

  if (isLoading) return <Spinner className="mx-auto my-8" />;

  if (error || story?.projectId !== projectId) {
    return (
      <div className="p-8 text-center" role="alert">
        <Typography variant="h2">Issue not found</Typography>
        <p className="text-muted-foreground mt-2">
          {error?.message ??
            "This issue is unavailable in the selected project."}
        </p>
        <Button
          className="mt-4"
          render={<Link href={`/project/${encodeURIComponent(projectId)}`} />}
        >
          Back to project
        </Button>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Button
        variant="outline"
        render={<Link href={`/project/${encodeURIComponent(projectId)}`} />}
      >
        Back to board
      </Button>
      <header className="space-y-3">
        <Typography variant="h1">{story.name}</Typography>
        <div className="flex flex-wrap gap-2">
          <Badge>{story.column}</Badge>
          {story.sprintNumber && (
            <Badge variant="outline">{story.sprintNumber}</Badge>
          )}
          {story.storyPoints != null && story.storyPoints > 0 && (
            <Badge variant="outline">{story.storyPoints} pts</Badge>
          )}
        </div>
      </header>
      {story.description ? (
        <Typography variant="p">{story.description}</Typography>
      ) : (
        <p className="text-muted-foreground">No description.</p>
      )}
      <section aria-labelledby="assignees-heading" className="space-y-2">
        <Typography variant="h3" id="assignees-heading">
          Assignees
        </Typography>
        {story.assignees.length > 0 ? (
          <ul className="list-inside list-disc">
            {story.assignees.map((assignee) => (
              <li key={assignee.userId}>
                {assignee.user?.name ?? assignee.userId}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No assignees.</p>
        )}
      </section>
    </article>
  );
}
