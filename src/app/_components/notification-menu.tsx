"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api, type RouterInputs, type RouterOutputs } from "@/trpc/react";
import { Typography } from "./typography";

type InvitationData = RouterOutputs["invite"]["listSelf"][number];
type ResponseAction = RouterInputs["invite"]["respond"]["action"];
type ResponseState = { pending?: ResponseAction; error?: boolean };
type Notice = { message: string; projectId?: string };

export function NotificationMenu() {
  // Mounted with the sidebar so invitations load before the menu is opened.
  const invitations = api.invite.listSelf.useQuery();
  const [notice, setNotice] = useState<Notice>();
  const count = invitations.data?.length ?? 0;
  // The popup unmounts on close. Keep action state here until requests finish.
  const [responses, setResponses] = useState<Record<string, ResponseState>>({});
  const utils = api.useUtils();
  const respond = api.invite.respond.useMutation({
    onMutate: (input) => {
      setResponses((current) => ({
        ...current,
        [input.projectId]: { pending: input.action },
      }));
    },
    onSuccess: async (_data, input) => {
      const name = invitations.data?.find(
        (item) => item.projectId === input.projectId,
      )?.projectName;
      setNotice({
        message:
          input.action === "accept"
            ? `Joined ${name ?? "the project"}.`
            : `Declined the invitation to ${name ?? "the project"}.`,
        projectId: input.action === "accept" ? input.projectId : undefined,
      });
      await Promise.all([
        utils.invite.listSelf.invalidate(),
        utils.project.list.invalidate(),
      ]);
    },
    onError: async (error, input) => {
      if (error.data?.code === "NOT_FOUND") {
        const name = invitations.data?.find(
          (item) => item.projectId === input.projectId,
        )?.projectName;
        setNotice({
          message: `The invitation to ${name ?? "the project"} has expired or is no longer available.`,
        });
        await Promise.all([
          utils.invite.listSelf.invalidate(),
          utils.project.list.invalidate(),
        ]);
      } else {
        setResponses((current) => ({
          ...current,
          [input.projectId]: { ...current[input.projectId], error: true },
        }));
      }
    },
    onSettled: (_data, _error, input) => {
      setResponses((current) => ({
        ...current,
        [input.projectId]: { ...current[input.projectId], pending: undefined },
      }));
    },
  });

  return (
    <Popover
      modal={false}
      onOpenChange={(open) => {
        if (!open) setNotice(undefined);
      }}
    >
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="relative" />}
        aria-label={
          count > 0
            ? `Notifications, ${count} pending invitation${count === 1 ? "" : "s"}`
            : "Notifications"
        }
      >
        <BellIcon aria-hidden="true" />
        {count > 0 && (
          <Badge aria-hidden="true" className="absolute -top-1 -right-2 px-1">
            {count}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="max-h-(--available-height) w-88 max-w-[calc(100vw-2rem)] [scrollbar-width:none] gap-0 overflow-y-auto p-0 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <PopoverTitle
            render={<Typography variant="h6" as="h2" />}
            className="font-semibold"
          >
            Notifications
          </PopoverTitle>
          {count > 0 && (
            <Typography variant="caption">{count} pending</Typography>
          )}
        </div>
        {notice && (
          <div className="space-y-3 border-b p-4">
            <Typography
              variant="caption"
              role="status"
              className="text-foreground break-words"
            >
              {notice.message}
            </Typography>
            {notice.projectId && (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/project/${encodeURIComponent(notice.projectId)}`}
                  />
                }
              >
                Open project
              </Button>
            )}
          </div>
        )}
        {invitations.isPending && (
          <Typography variant="caption" role="status" className="p-4">
            Loading notifications...
          </Typography>
        )}
        {invitations.isError && (
          <div className="space-y-3 p-4">
            <Typography
              variant="caption"
              role="alert"
              className="text-destructive"
            >
              Could not load notifications.
            </Typography>
            <Button
              variant="outline"
              disabled={invitations.isFetching}
              onClick={() => void invitations.refetch()}
            >
              Retry loading notifications
            </Button>
          </div>
        )}
        {!invitations.isPending && !invitations.isError && count === 0 && (
          <Typography variant="caption" className="p-4">
            No notifications
          </Typography>
        )}
        <ul className="divide-y">
          {invitations.data?.map((invitation) => (
            <Invitation
              key={invitation.projectId}
              invitation={invitation}
              response={responses[invitation.projectId]}
              onRespond={(action) =>
                respond.mutate({ projectId: invitation.projectId, action })
              }
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function Invitation({
  invitation,
  response,
  onRespond,
}: {
  invitation: InvitationData;
  response?: ResponseState;
  onRespond: (action: ResponseAction) => void;
}) {
  return (
    <li className="space-y-3 p-4">
      <div className="space-y-1">
        <Typography variant="h6" as="h3" className="break-words">
          {invitation.projectName}
        </Typography>
        <Typography variant="caption">
          {invitation.expiresAt <= new Date() ? "Expired" : "Expires"}{" "}
          <time
            dateTime={invitation.expiresAt.toISOString()}
            title={invitation.expiresAt.toLocaleString()}
          >
            {formatDistanceToNowStrict(invitation.expiresAt, {
              addSuffix: true,
            })}
          </time>
        </Typography>
      </div>
      {response?.error && (
        <Typography variant="caption" role="alert" className="text-destructive">
          Could not respond to this invitation. Please try again.
        </Typography>
      )}
      <div className="flex gap-2">
        <Button
          disabled={!!response?.pending}
          onClick={() => onRespond("accept")}
          aria-label={`Accept invitation to ${invitation.projectName}`}
        >
          {response?.pending === "accept" ? "Accepting..." : "Accept"}
        </Button>
        <Button
          variant="outline"
          disabled={!!response?.pending}
          onClick={() => onRespond("deny")}
          aria-label={`Decline invitation to ${invitation.projectName}`}
        >
          {response?.pending === "deny" ? "Declining..." : "Decline"}
        </Button>
      </div>
    </li>
  );
}
