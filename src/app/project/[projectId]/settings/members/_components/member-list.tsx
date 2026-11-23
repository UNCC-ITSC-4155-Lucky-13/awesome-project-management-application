"use client";

import { useState } from "react";

import { Typography } from "@/app/_components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type RouterOutputs } from "@/trpc/react";

import { RemoveMemberDialog } from "./remove-member-dialog";

type Member = RouterOutputs["member"]["list"][number];

const ROLES = ["owner", "admin", "member"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: unknown): value is Role {
  return ROLES.some((role) => role === value);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function describeError(code: string | undefined, fallback: string) {
  if (code === "FORBIDDEN") return "You no longer have permission to do that.";
  if (code === "NOT_FOUND") return "That member is no longer in this project.";
  return fallback;
}

export function MemberList({
  projectId,
  currentUserId,
  members,
  hasError,
  isFetching,
  onRetry,
}: {
  projectId: string;
  currentUserId: string | undefined;
  members: Member[] | undefined;
  hasError: boolean;
  isFetching: boolean;
  onRetry: () => void;
}) {
  const utils = api.useUtils();
  const [memberToRemove, setMemberToRemove] = useState<Member>();

  // Refresh the member list and the issue views that show assignees.
  const refreshMembers = () =>
    Promise.all([
      utils.member.list.invalidate({ projectId }),
      utils.story.invalidate(),
    ]);

  const updateRole = api.member.updateRole.useMutation({
    onSuccess: refreshMembers,
    onError: async (error) => {
      // Permissions or the target changed underneath us. Re-sync with the server.
      if (error.data?.code === "FORBIDDEN") {
        await utils.project.list.invalidate();
      }
      await utils.member.list.invalidate({ projectId });
    },
  });
  const removeMember = api.member.remove.useMutation({
    onSuccess: async () => {
      setMemberToRemove(undefined);
      // Also refresh projects: removing yourself ends your access.
      await Promise.all([refreshMembers(), utils.project.list.invalidate()]);
    },
    onError: async (error) => {
      if (error.data?.code === "FORBIDDEN") {
        await utils.project.list.invalidate();
      }
      await utils.member.list.invalidate({ projectId });
    },
  });
  // One request at a time, so a double click can't submit twice.
  const busy = updateRole.isPending || removeMember.isPending;

  const viewerRole = members?.find(
    (member) => member.userId === currentUserId,
  )?.role;
  // Matches the backend: only owners and admins can manage members.
  const canManage = viewerRole === "owner" || viewerRole === "admin";

  if (hasError) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Couldn&apos;t load members</CardTitle>
          <CardDescription>
            Something went wrong. Check your connection and try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={isFetching} onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!members) {
    return (
      <Card aria-busy="true">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Loading members…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          {members.length} {members.length === 1 ? "member" : "members"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.length === 0 ? (
          <Typography variant="caption">No members yet.</Typography>
        ) : (
          <ul className="divide-y">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <Avatar>
                  <AvatarImage src={member.image ?? undefined} alt="" />
                  <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                </Avatar>
                <Typography className="min-w-0 flex-1 font-medium break-words">
                  {member.name}
                  {member.userId === currentUserId && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </Typography>
                {canManage ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      disabled={busy}
                      onValueChange={(value) => {
                        if (isRole(value) && value !== member.role) {
                          updateRole.mutate({
                            projectId,
                            userId: member.userId,
                            role: value,
                          });
                        }
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label={`Role for ${member.name}`}
                      >
                        <SelectValue className="capitalize" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            <span className="capitalize">{role}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      aria-label={`Remove ${member.name}`}
                      onClick={() => {
                        removeMember.reset();
                        setMemberToRemove(member);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {member.role}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        {updateRole.isError && (
          <Typography
            variant="caption"
            role="alert"
            className="text-destructive"
          >
            {describeError(
              updateRole.error.data?.code,
              "Couldn't change that role. Please try again.",
            )}
          </Typography>
        )}
      </CardContent>
      <RemoveMemberDialog
        memberName={memberToRemove?.name}
        isSelf={memberToRemove?.userId === currentUserId}
        pending={removeMember.isPending}
        error={
          removeMember.isError
            ? describeError(
                removeMember.error.data?.code,
                "Couldn't remove this member. Please try again.",
              )
            : undefined
        }
        onConfirm={() => {
          if (memberToRemove && !removeMember.isPending) {
            removeMember.mutate({
              projectId,
              userId: memberToRemove.userId,
            });
          }
        }}
        onClose={() => {
          removeMember.reset();
          setMemberToRemove(undefined);
        }}
      />
    </Card>
  );
}
