"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { BLANK_COMMENT_MESSAGE, normalizeCommentContent } from "@/lib/comments";

type CommentEditorProps = {
  /** Accessible name for the text box. */
  label: string;
  submitLabel: string;
  pendingLabel: string;
  initialValue?: string;
  placeholder?: string;
  /** Move focus into the text box when the editor mounts. */
  autoFocus?: boolean;
  /** Provide to show a Cancel button and enable Escape to cancel. */
  onCancel?: () => void;
  /**
   * Save the trimmed content. Resolve on success; throw (or reject) with an
   * Error whose message is shown to the user to keep the draft for a retry.
   */
  onSubmit: (content: string) => Promise<void>;
  /** Id for the textarea, so other code can focus it. */
  textareaId?: string;
};

/**
 * Textarea with submit/cancel controls shared by "new comment" and "edit
 * comment". The draft lives here so it survives failed requests.
 */
export function CommentEditor({
  label,
  submitLabel,
  pendingLabel,
  initialValue = "",
  placeholder,
  autoFocus = false,
  onCancel,
  onSubmit,
  textareaId,
}: CommentEditorProps) {
  const generatedId = useId();
  const id = textareaId ?? generatedId;
  const messageId = `${id}-message`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // A ref, not state, so two quick clicks can't both pass the check before a
  // re-render disables the button.
  const submitting = useRef(false);
  const [draft, setDraft] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!autoFocus) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, [autoFocus]);

  const unchanged =
    normalizeCommentContent(draft) === normalizeCommentContent(initialValue);
  // Editing without changing anything has nothing to save.
  const nothingToSave = initialValue !== "" && unchanged;

  async function submit() {
    if (submitting.current) return;

    const content = normalizeCommentContent(draft);
    if (!content) {
      setError(BLANK_COMMENT_MESSAGE);
      textareaRef.current?.focus();
      return;
    }
    if (nothingToSave) return;

    submitting.current = true;
    setPending(true);
    setError(undefined);
    try {
      await onSubmit(content);
      // Only a successful request clears the box. An edit keeps its text;
      // the parent closes the editor.
      if (initialValue === "") setDraft("");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      textareaRef.current?.focus();
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        id={id}
        ref={textareaRef}
        value={draft}
        placeholder={placeholder}
        readOnly={pending}
        aria-busy={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
        className="min-h-20 resize-y [overflow-wrap:anywhere] read-only:opacity-70"
        onChange={(event) => {
          setDraft(event.target.value);
          if (error) setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          } else if (event.key === "Escape" && onCancel && !pending) {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || nothingToSave}>
          {pending && <Spinner aria-hidden role="presentation" />}
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <span className="text-muted-foreground hidden text-xs sm:inline">
          Ctrl/⌘ + Enter to submit{onCancel ? ", Esc to cancel" : ""}
        </span>
      </div>
      {/* Always mounted so screen readers announce errors when they appear. */}
      <p
        id={messageId}
        role="alert"
        className="text-destructive text-sm empty:hidden"
      >
        {error}
      </p>
    </form>
  );
}
