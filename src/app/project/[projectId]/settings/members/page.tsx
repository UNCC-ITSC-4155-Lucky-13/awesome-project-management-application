import { Typography } from "@/app/_components/typography";
import { getSession } from "@/server/better-auth/server";

import { ProjectMembers } from "./_components/project-members";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await getSession();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-3">
        <Typography variant="h1">Manage members</Typography>
        <Typography variant="subtitle">
          Manage project members and invitations here.
        </Typography>
      </div>
      <ProjectMembers projectId={projectId} currentUserId={session?.user.id} />
    </div>
  );
}
