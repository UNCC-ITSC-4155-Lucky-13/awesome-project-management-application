export type ProjectRole = "owner" | "admin" | "member";

export const BLANK_COMMENT_MESSAGE = "Write a comment before submitting.";

/** Mirrors the server: content is trimmed and must not be empty. */
export function normalizeCommentContent(value: string) {
  return value.trim();
}

/** Only the author may edit a comment, whatever their role. */
export function canEditComment(
  comment: { author: { id: string } },
  currentUserId: string | null | undefined,
) {
  return !!currentUserId && comment.author.id === currentUserId;
}

/** The author, or a project admin/owner, may delete a comment. */
export function canDeleteComment(
  comment: { author: { id: string } },
  currentUserId: string | null | undefined,
  role: ProjectRole | null | undefined,
) {
  if (!currentUserId) return false;
  if (comment.author.id === currentUserId) return true;
  return role === "owner" || role === "admin";
}

/** Reads the tRPC error code from a caught value, if it has one. */
export function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return undefined;
  }
  const data = error.data;
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return undefined;
  }
  return typeof data.code === "string" ? data.code : undefined;
}

/** True when the server says the caller no longer belongs to the project. */
export const isMembershipError = (error: unknown) =>
  errorCode(error) === "FORBIDDEN";

export const isNotFoundError = (error: unknown) =>
  errorCode(error) === "NOT_FOUND";

type WriteAction = "post" | "save" | "delete";

/** A user-facing message for a failed comment write. */
export function commentWriteErrorMessage(action: WriteAction, error: unknown) {
  const code = errorCode(error);
  if (code === "FORBIDDEN") {
    return action === "delete"
      ? "You don't have permission to delete this comment, or you're no longer a member of this project."
      : "You can't change comments here anymore. You may no longer be a member of this project.";
  }
  if (code === "NOT_FOUND") {
    return action === "post"
      ? "This issue is no longer available."
      : "This comment no longer exists.";
  }
  if (code === "BAD_REQUEST") {
    return BLANK_COMMENT_MESSAGE;
  }
  const verb =
    action === "post"
      ? "post your comment"
      : action === "save"
        ? "save your changes"
        : "delete the comment";
  return action === "delete"
    ? `We couldn't ${verb}. Please try again.`
    : `We couldn't ${verb}. Your text is still here. Please try again.`;
}

/** One or two uppercase initials for an avatar fallback. */
export function getAuthorInitials(name: string | null | undefined) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
}
