"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";

import { Typography } from "@/app/_components/typography";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { parseGithubUsername } from "@/lib/github-username";
import { api } from "@/trpc/react";

type SentInvite = { username: string; renewed: boolean; expiresAt: Date };

function Expiry({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString()}>
      {formatDistanceToNowStrict(date, { addSuffix: true })}
    </time>
  );
}

export function InviteSection({ projectId }: { projectId: string }) {
  const utils = api.useUtils();
  const [username, setUsername] = useState("");
  const [validationError, setValidationError] = useState<string>();
  const [sent, setSent] = useState<SentInvite>();

  const {
    data: invitations,
    error: listError,
    isFetching,
    refetch,
  } = api.invite.listProject.useQuery({ projectId });

  const sendInvite = api.invite.send.useMutation({
    onError: async (error) => {
      // Membership was lost. The member list detects it and shows the notice.
      if (error.data?.code === "FORBIDDEN") {
        await Promise.all([
          utils.member.list.invalidate({ projectId }),
          utils.project.list.invalidate(),
        ]);
      }
    },
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendInvite.isPending) return;

    const parsed = parseGithubUsername(username);
    if ("error" in parsed) {
      setValidationError(parsed.error);
      return;
    }

    setValidationError(undefined);
    setSent(undefined);
    // The backend renews an existing invitation instead of adding a second one.
    const renewed =
      invitations?.some((invite) => invite.githubUsername === parsed.value) ??
      false;

    sendInvite.mutate(
      { projectId, githubUsername: parsed.value },
      {
        // Per-call callbacks must return void, so the refresh isn't awaited.
        onSuccess: (invite) => {
          setUsername("");
          setSent({
            username: invite.githubUsername,
            renewed,
            expiresAt: invite.expiresAt,
          });
          void utils.invite.listProject.invalidate({ projectId });
        },
      },
    );
  }

  const sendError = sendInvite.isError
    ? sendInvite.error.data?.code === "FORBIDDEN"
      ? "You no longer have access to this project."
      : "Couldn't send the invitation. Your input is kept, so you can try again."
    : undefined;
  const fieldError = validationError ?? sendError;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite people</CardTitle>
        <CardDescription>
          Invite someone by their GitHub username. They can accept from the
          notification menu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={submit} noValidate className="space-y-3">
          <Field data-invalid={!!fieldError}>
            <FieldLabel htmlFor="invite-username">GitHub username</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <Input
                id="invite-username"
                value={username}
                maxLength={300}
                autoComplete="off"
                aria-invalid={!!fieldError}
                className="min-w-0 flex-1"
                onChange={(event) => {
                  setUsername(event.target.value);
                  setValidationError(undefined);
                  if (sendInvite.isError) sendInvite.reset();
                }}
              />
              <Button type="submit" disabled={sendInvite.isPending}>
                {sendInvite.isPending ? "Sending…" : "Send invitation"}
              </Button>
            </div>
            <FieldError>{fieldError}</FieldError>
          </Field>
          {sent && (
            <Typography variant="caption" role="status">
              {sent.renewed
                ? `Renewed the invitation for @${sent.username}. It now expires `
                : `Invited @${sent.username}. The invitation expires `}
              <Expiry date={sent.expiresAt} />.
            </Typography>
          )}
        </form>

        <div className="space-y-3">
          <Typography variant="h6" as="h3">
            Pending invitations
          </Typography>
          {listError ? (
            <div className="space-y-3">
              <Typography
                variant="caption"
                role="alert"
                className="text-destructive"
              >
                Couldn&apos;t load pending invitations.
              </Typography>
              <Button
                variant="outline"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </div>
          ) : !invitations ? (
            <Typography variant="caption" role="status">
              Loading invitations…
            </Typography>
          ) : invitations.length === 0 ? (
            <Typography variant="caption">No pending invitations.</Typography>
          ) : (
            <ul className="divide-y">
              {[...invitations]
                .sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())
                .map((invite) => (
                  <li
                    key={invite.githubUsername}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <Typography className="min-w-0 font-medium break-words">
                      @{invite.githubUsername}
                    </Typography>
                    <Typography variant="caption">
                      Expires <Expiry date={invite.expiresAt} />
                    </Typography>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
