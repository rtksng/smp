import { AlertTriangle, RefreshCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

type ErrorStateProps = {
  action?: ReactNode;
  className?: string;
  message?: string;
  title?: string;
};

type RetryButtonProps = {
  isRetrying?: boolean;
  label?: string;
  onRetry: () => void;
};

export function ErrorState({
  action,
  className,
  message = "Refresh the page or try again in a moment.",
  title = "Unable to load this section"
}: ErrorStateProps) {
  return (
    <div
      className={[
        "rounded-lg border border-[#f4c7c3] bg-[#fff5f5] p-5 text-[#7a271a]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#b42318]">
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-snug">{title}</h2>
          <p className="mt-2 break-words text-sm font-bold leading-6">{message}</p>
          {action ? <div className="mt-5 flex flex-wrap gap-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function RetryButton({
  isRetrying = false,
  label = "Try again",
  onRetry
}: RetryButtonProps) {
  return (
    <Button disabled={isRetrying} onClick={onRetry} variant="outline">
      <RefreshCcw aria-hidden="true" className="h-4 w-4" />
      {isRetrying ? "Retrying..." : label}
    </Button>
  );
}
