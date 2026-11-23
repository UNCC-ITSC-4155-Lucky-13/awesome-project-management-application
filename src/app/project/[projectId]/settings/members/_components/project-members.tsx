"use client";

import { api } from "@/trpc/react";

import { InviteSection } from "./invite-section";
import { MemberList } from "./member-list";
import { NoAccess } from "./no-access";

export function ProjectMembers({
  projectId,
  currentUserId,
}: {
  projectId: string;
  currentUserId: string | undefined;
}) {
  const {
    data: members,
    error,
    isFetching,
    refetch,
  } = api.member.list.useQuery({ projectId });

  // Membership was lost while the screen was open.
  if (error?.data?.code === "FORBIDDEN") {
    return <NoAccess />;
  }

  return (
    <>
      <MemberList
        projectId={projectId}
        currentUserId={currentUserId}
        members={members}
        hasError={!!error}
        isFetching={isFetching}
        onRetry={() => void refetch()}
      />
      <InviteSection projectId={projectId} />
    </>
  );
}
