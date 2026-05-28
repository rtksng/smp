"use client";

import { useEffect, useState } from "react";

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

  if (!confirmation) {
    return null;
  }

  async function confirm() {
    if (!confirmation) {
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
    <div className="dialogBackdrop" role="presentation">
      <div aria-modal="true" className="confirmationDialog" role="dialog">
        <h2>{confirmation.title}</h2>
        <p>{confirmation.body}</p>
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}
        <div className="actionRow">
          <button
            className="dangerButton"
            disabled={isPending}
            onClick={() => void confirm()}
            type="button"
          >
            {isPending ? "Working..." : confirmation.confirmLabel}
          </button>
          <button
            className="ghostButton"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
