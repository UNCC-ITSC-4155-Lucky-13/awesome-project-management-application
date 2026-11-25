"use client";

import { MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CommentEditor } from "@/app/_components/comment-editor";
import {
  type CommentData,
  commentEditButtonId,
  CommentItem,
} from "@/app/_components/comment-item";
import { Typography, typographyVariants } from "@/app/_components/typography";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  canDeleteComment,
  canEditComment,
  commentWriteErrorMessage,
  isMembershipError,
  isNotFoundError,
} from "@/lib/comments";
import { cn } from "@/lib/utils";
import { PROJECT_SELECTION_PATH } from "@/lib/project-navigation";
import { authClient } from "@/server/better-auth/client";
import { api } from "@/trpc/react";

type CommentThreadProps = {
  projectId: string;
  storyId: string;
};

/**
 * The comment list and composer for one issue. Reusable anywhere an issue's
 * comments are shown; it loads its own data and keeps the issue's cached
 * data (including list-view comment counts) fresh after every change.
 */
export function CommentThread({ projectId, storyId }: CommentThreadProps) {
  const utils = api.useUtils();
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user.id;

  const project = api.project.getById.useQuery({ projectId }, { retry: false });
  const comments = api.comment.list.useQuery({ storyId }, { retry: false });
  const role = project.data?.role;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommentData | null>(null);
  const [deleteError, setDeleteError] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreFocusTo = useRef<string | null>(null);

  const createComment = api.comment.create.useMutation();
  const editComment = api.comment.edit.useMutation();
  const deleteComment = api.comment.delete.useMutation();
  const busy =
    createComment.isPending || editComment.isPending || deleteComment.isPending;

  // After an editor closes, put keyboard focus back where the user was.
  useEffect(() => {
    if (editingId === null && restoreFocusTo.current) {
      document.getElementById(restoreFocusTo.current)?.focus();
      restoreFocusTo.current = null;
    }
  }, [editingId]);

  const lostMembership =
    isMembershipError(comments.error) || isMembershipError(project.error);

  /** Refetch the thread and every view that shows this issue's count. */
  async function refreshAfterChange() {
    await Promise.all([
      utils.comment.list.invalidate({ storyId }),
      utils.story.list.invalidate(),
      utils.story.getById.invalidate({ id: storyId }),
    ]);
  }

  /** A permission failure may mean our role or membership changed. */
  async function refreshAccess() {
    await Promise.all([
      utils.project.getById.invalidate({ projectId }),
      utils.comment.list.invalidate({ storyId }),
    ]);
  }

  async function handleCreate(content: string) {
    try {
      await createComment.mutateAsync({ storyId, content });
    } catch (error) {
      if (isMembershipError(error)) void refreshAccess();
      throw new Error(commentWriteErrorMessage("post", error));
    }
    await refreshAfterChange();
    toast.add({ type: "success", title: "Comment posted" });
  }

  async function handleEdit(comment: CommentData, content: string) {
    try {
      await editComment.mutateAsync({ id: comment.id, content });
    } catch (error) {
      if (isNotFoundError(error)) {
        setEditingId(null);
        void refreshAfterChange();
        toast.add({
          type: "error",
          title: "This comment was deleted",
          description: "Your changes couldn't be saved.",
        });
      }

      throw new Error(commentWriteErrorMessage("save", error));
    }
    // Keep the editor (read-only) until the fresh text arrives, so the old
    // text never flashes back.
    await refreshAfterChange();
    restoreFocusTo.current = commentEditButtonId(comment.id);
    setEditingId(null);
    toast.add({ type: "success", title: "Comment updated" });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteComment.isPending) return;
    setDeleteError(undefined);

    try {
      await deleteComment.mutateAsync({ id: deleteTarget.id });
    } catch (error) {
      if (isNotFoundError(error)) {
        // Already gone: the goal of the click is met, so just resync.
        setDeleteTarget(null);
        void refreshAfterChange();
        toast.add({ type: "info", title: "That comment was already deleted" });
        return;
      }
      if (isMembershipError(error)) void refreshAccess();
      setDeleteError(commentWriteErrorMessage("delete", error));
      return;
    }

    setDeleteTarget(null);
    if (editingId === deleteTarget.id) setEditingId(null);
    await refreshAfterChange();
    toast.add({ type: "success", title: "Comment deleted" });
    headingRef.current?.focus();
  }

  const items = comments.data ?? [];
  // Ignore an edit target that has since disappeared from the list.
  const activeEditingId = items.some((item) => item.id === editingId)
    ? editingId
    : null;

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <h2
          id="comments-heading"
          tabIndex={-1}
          ref={headingRef}
          className={cn(typographyVariants({ variant: "h4" }), "outline-none")}
        >
          Comments
          {comments.data && (
            <span className="text-muted-foreground ml-2 text-base font-normal">
              ({items.length})
            </span>
          )}
        </h2>
      </div>

      {lostMembership ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 space-y-2 rounded-lg border p-4"
        >
          <Typography variant="h6" as="p">
            You no longer have access to this project
          </Typography>
          <Typography variant="caption">
            Your membership may have been removed, so comments can&apos;t be
            shown or changed.
          </Typography>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={PROJECT_SELECTION_PATH} />}
          >
            Back to your projects
          </Button>
        </div>
      ) : comments.isPending ? (
        <div
          className="space-y-4"
          role="status"
          aria-live="polite"
          aria-label="Loading comments"
        >
          {[0, 1].map((key) => (
            <div key={key} className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.isError && !comments.data ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
        >
          <Typography variant="caption" className="text-foreground">
            We couldn&apos;t load the comments.
          </Typography>
          <Button
            variant="outline"
            disabled={comments.isFetching}
            onClick={() => void comments.refetch()}
          >
            {comments.isFetching && <Spinner aria-hidden role="presentation" />}
            Try again
          </Button>
        </div>
      ) : (
        <>
          {comments.isError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <Typography variant="caption">
                Couldn&apos;t refresh comments. These may be out of date.
              </Typography>
              <Button
                variant="outline"
                size="sm"
                disabled={comments.isFetching}
                onClick={() => void comments.refetch()}
              >
                Refresh
              </Button>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
              <MessageSquareIcon aria-hidden className="size-6" />
              <Typography variant="caption">
                No comments yet. Start the conversation below.
              </Typography>
            </div>
          ) : (
            <ol className="space-y-5">
              {items.map((comment) => {
                const isEditing = comment.id === activeEditingId;
                return (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    canEdit={canEditComment(comment, currentUserId)}
                    canDelete={canDeleteComment(comment, currentUserId, role)}
                    isEditing={isEditing}
                    busy={busy}
                    onEdit={() => setEditingId(comment.id)}
                    onDelete={() => {
                      setDeleteError(undefined);
                      setDeleteTarget(comment);
                    }}
                  >
                    {isEditing && (
                      <CommentEditor
                        label="Edit comment"
                        submitLabel="Save"
                        pendingLabel="Saving…"
                        initialValue={comment.content}
                        autoFocus
                        onSubmit={(content) => handleEdit(comment, content)}
                        onCancel={() => {
                          restoreFocusTo.current = commentEditButtonId(
                            comment.id,
                          );
                          setEditingId(null);
                        }}
                      />
                    )}
                  </CommentItem>
                );
              })}
            </ol>
          )}

          <div className="border-t pt-4">
            <CommentEditor
              textareaId={`new-comment-${storyId}`}
              label="Add a comment"
              placeholder="Add a comment…"
              submitLabel="Comment"
              pendingLabel="Posting…"
              onSubmit={handleCreate}
            />
          </div>
        </>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          // Don't let the dialog close mid-request.
          if (!open && !deleteComment.isPending) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this comment?</DialogTitle>
            <DialogDescription>
              This permanently removes the comment
              {deleteTarget?.author.name
                ? ` by ${deleteTarget.author.name}`
                : ""}
              . This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <p role="alert" className="text-destructive text-sm empty:hidden">
            {deleteError}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleteComment.isPending}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteComment.isPending}
              onClick={() => void confirmDelete()}
            >
              {deleteComment.isPending && (
                <Spinner aria-hidden role="presentation" />
              )}
              {deleteComment.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
