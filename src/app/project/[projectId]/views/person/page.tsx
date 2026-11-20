"use client";

import { useParams } from "next/navigation";
import { DefaultViewRedirect } from "@/app/_components/DefaultViewRedirect";

export default function PersonViewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <DefaultViewRedirect projectId={projectId} viewName="By person" />;
}
