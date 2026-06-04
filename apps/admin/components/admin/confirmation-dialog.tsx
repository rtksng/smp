"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export type ConfirmationState = {
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  title: string;
};

export function ConfirmationDialog({
  confirmation,
  isPending,
  onCancel,
  onConfirmComplete
}: {
  confirmation: ConfirmationState | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirmComplete: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [confirmation]);

  async function confirm() {
    if (!confirmation || isPending) {
      return;
    }

    try {
      setError(null);
      await confirmation.onConfirm();
      onConfirmComplete();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    }
  }

  return (
    <Dialog
      open={Boolean(confirmation)}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onCancel();
        }
      }}
    >
      <DialogContent
        hideCloseButton
        isDismissable={false}
        isKeyboardDismissDisabled
      >
        <DialogHeader>
          <span aria-hidden className="confirmationIcon">
            <AlertTriangle size={20} />
          </span>
          <div>
            <DialogTitle>{confirmation?.title ?? "Confirm action"}</DialogTitle>
            <DialogDescription>{confirmation?.body ?? ""}</DialogDescription>
          </div>
        </DialogHeader>
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => {
              if (!isPending) {
                onCancel();
              }
            }}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isPending} onClick={() => void confirm()} type="button" variant="destructive">
            {isPending ? "Working..." : confirmation?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
