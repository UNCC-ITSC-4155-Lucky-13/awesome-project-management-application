"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Typography } from "@/app/_components/typography";
import { api } from "@/trpc/react";

export function DefaultViewRedirect({
  projectId,
  viewName,
}: {
  projectId: string;
  viewName: string;
}) {
  const router = useRouter();
  const {
    data: views,
    isLoading,
    error,
  } = api.view.list.useQuery({ projectId });
  const namedView = views?.find((candidate) => candidate.name === viewName);
  const matchingDefault = views?.find((candidate) => {
    if (candidate.ownerUserId !== null) return false;
    const row =
      candidate.configuration.grouping?.row !== undefined
        ? candidate.configuration.grouping.row
        : candidate.configuration.rowSplit !== undefined
          ? candidate.configuration.rowSplit
          : candidate.configuration.rowGroup;
    if (viewName === "By person") return row === "assignee";
    return (
      row !== "assignee" &&
      (candidate.configuration.grouping?.column ??
        candidate.configuration.groupBy ??
        "status") === "status"
    );
  });
  const view =
    namedView ??
    matchingDefault ??
    views?.find((candidate) => candidate.ownerUserId === null) ??
    views?.[0];

  useEffect(() => {
    if (view)
      router.replace(
        `/project/${encodeURIComponent(projectId)}/views/${view.id}`,
      );
  }, [projectId, router, view]);

  if (isLoading || view) return <Spinner className="mx-auto my-8" />;

  return (
    <div className="p-8 text-center" role="alert">
      <Typography variant="h2">
        {error ? "Could not load views" : "Default view not found"}
      </Typography>
      <p className="text-muted-foreground mt-2">
        {error?.message ?? `The ${viewName} view is unavailable.`}
      </p>
    </div>
  );
}
