import type { ReactNode } from "react";
import { ErrorState } from "./error-state";

type ErrorMessageProps = {
  action?: ReactNode;
  message: string;
  title?: string;
};

export function ErrorMessage({
  action,
  message,
  title = "Unable to load this section"
}: ErrorMessageProps) {
  return <ErrorState action={action} message={message} title={title} />;
}
