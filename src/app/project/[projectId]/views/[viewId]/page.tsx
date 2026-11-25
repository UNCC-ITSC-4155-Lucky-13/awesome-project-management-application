"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { ViewHeader } from "@/app/_components/ViewHeader";
import { ViewRenderer } from "@/app/_components/ViewRenderer";
import { Spinner } from "@/components/ui/spinner";
import { Typography } from "@/app/_components/typography";
import { toast } from "@/components/ui/toast";

export default function ViewPage() {
  const { projectId, viewId } = useParams<{
    projectId: string;
    viewId: string;
  }>();

  // Fetch the view definition
  const {
    data: view,
    isLoading: viewLoading,
    error: viewError,
  } = api.view.getById.useQuery({ projectId, id: viewId }, { retry: false });

  // Show toast when the query errors
  useEffect(() => {
    if (viewError) toast.add({ type: "error", title: viewError.message });
  }, [viewError]);

  // If loading view definition, show spinner
  if (viewLoading) return <Spinner className="mx-auto my-8" />;

  if (viewError || !view) {
    return (
      <div className="p-8 text-center" role="alert">
        <Typography variant="h2">View not found</Typography>
        <p className="text-muted-foreground mt-2">
          {viewError?.message ??
            "The requested view does not exist or you lack permission."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with name/icon and edit/delete controls */}
      <ViewHeader
        viewId={view.id}
        projectId={projectId}
        initialName={view.name}
        initialIcon={view.icon}
        initialConfiguration={view.configuration}
        ownerUserId={view.ownerUserId}
      />

      {/* Main content – render columns based on configuration */}
      <div className="flex-1 overflow-y-auto p-4">
        <ViewRenderer
          projectId={projectId}
          configuration={view.configuration}
        />
      </div>
    </div>
  );
}
