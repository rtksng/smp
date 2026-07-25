import { z } from "zod";
import { ApiError } from "./api/client";

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired. Please sign in again.";
    }

    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
