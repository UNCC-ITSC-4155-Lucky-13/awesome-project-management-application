"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { Typography } from "@/app/_components/typography";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getAuthorInitials } from "@/lib/comments";
import { type RouterOutputs } from "@/trpc/react";

export type CommentData = RouterOutputs["comment"]["list"][number];

export const commentElementId = (commentId: string) => `comment-${commentId}`;
export const commentEditButtonId = (commentId: string) =>
  `comment-${commentId}-edit`;

type CommentItemProps = {
  comment: CommentData;
  canEdit: boolean;
  canDelete: boolean;
  /** While editing, `children` (the editor) replaces the comment text. */
  isEditing: boolean;
  /** Disables the action buttons while a write is in flight. */
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
};

export function CommentItem({
  comment,
  canEdit,
  canDelete,
  isEditing,
  busy,
  onEdit,
  onDelete,
  children,
}: CommentItemProps) {
  const authorName = comment.author.name || "Unknown user";

  return (
    <li
      id={commentElementId(comment.id)}
      className="flex gap-3 [overflow-wrap:anywhere]"
    >
      <Avatar aria-hidden className="mt-0.5">
        {comment.author.image && (
          <AvatarImage src={comment.author.image} alt="" />
        )}
        <AvatarFallback>
          {getAuthorInitials(comment.author.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Typography variant="h6" as="span" className="text-sm">
            {authorName}
          </Typography>
          <Typography variant="caption" as="span">
            <time
              dateTime={comment.createdAt.toISOString()}
              title={comment.createdAt.toLocaleString()}
            >
              {formatDistanceToNowStrict(comment.createdAt, {
                addSuffix: true,
              })}
            </time>
            {comment.editedAt && (
              <>
                {" "}
                <span title={`Edited ${comment.editedAt.toLocaleString()}`}>
                  (edited)
                </span>
              </>
            )}
          </Typography>
          {!isEditing && (canEdit || canDelete) && (
            <div className="ml-auto flex items-center gap-1">
              {canEdit && (
                <Button
                  id={commentEditButtonId(comment.id)}
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  aria-label={`Edit comment by ${authorName}`}
                  onClick={onEdit}
                >
                  <PencilIcon aria-hidden />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={busy}
                  aria-label={`Delete comment by ${authorName}`}
                  onClick={onDelete}
                >
                  <Trash2Icon aria-hidden />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
        {isEditing ? (
          children
        ) : (
          // Plain text child, never HTML: React escapes it, and
          // whitespace-pre-wrap keeps the author's line breaks.
          <div className="text-sm leading-6 break-words whitespace-pre-wrap">
            {comment.content}
          </div>
        )}
      </div>
    </li>
  );
}
