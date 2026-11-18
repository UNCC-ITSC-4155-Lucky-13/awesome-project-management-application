"use client";

import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { ViewHeader } from "@/app/_components/ViewHeader";
import { ViewRenderer } from "@/app/_components/ViewRenderer";
import { Spinner } from "@/components/ui/spinner";
import { Typography } from "@/app/_components/typography";
import { toast } from "@/components/ui/toast";

export default function ViewPage() {
  const { projectId, viewId } = useParams<{ projectId: string; viewId: string }>();

  const utils = api.useContext();

  // Fetch the view definition
  const { data: view, isLoading: viewLoading, error: viewError } =
    api.view.getById.useQuery({ projectId, id: viewId }, {
      retry: false,
      onError: (err) => toast.error(err.message),
    });

  // If loading view definition, show spinner
  if (viewLoading) return <Spinner className="mx-auto my-8" />;
  if (viewError || !view) {
    return (
      <div className="p-8 text-center">
        <Typography variant="h2">View not found</Typography>
        <p className="mt-2 text-gray-600">{viewError?.message ?? "The requested view does not exist or you lack permission."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with name/icon and edit/delete controls */}
      <ViewHeader
        viewId={view.id}
        projectId={projectId}
        initialName={view.name}
        initialIcon={view.icon}
      />

      {/* Main content – render columns based on configuration */}
      <div className="flex-1 overflow-y-auto p-4">
        <ViewRenderer projectId={projectId} viewId={view.id} configuration={view.configuration} />
      </div>
    </div>
  );
}
