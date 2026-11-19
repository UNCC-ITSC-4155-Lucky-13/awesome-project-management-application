"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Typography } from "@/app/_components/typography";

export function RemoveMemberDialog({
  memberName,
  isSelf,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  // The member being removed. The dialog is closed when this is undefined.
  memberName: string | undefined;
  isSelf: boolean;
  pending: boolean;
  error: string | undefined;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={memberName !== undefined}
      onOpenChange={(open) => {
        // Keep the dialog open while the request is in flight.
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {isSelf ? "Leave this project?" : `Remove ${memberName}?`}
          </DialogTitle>
          <DialogDescription>
            {isSelf
              ? "You will lose access to this project."
              : "They will lose access to this project."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Typography
            variant="caption"
            role="alert"
            className="text-destructive"
          >
            {error}
          </Typography>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Removing…" : error ? "Try again" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
