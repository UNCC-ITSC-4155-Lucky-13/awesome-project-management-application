"use client";

import { useParams } from "next/navigation";
import { DefaultViewRedirect } from "@/app/_components/default-view-redirect";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <DefaultViewRedirect projectId={projectId} viewName="Board" />;
}
