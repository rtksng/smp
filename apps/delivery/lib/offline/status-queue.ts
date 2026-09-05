import type { StatusUpdateInput } from "../api/types";

export type QueuedStatusUpdate = {
  id: string;
  assignmentId: string;
  payload: StatusUpdateInput;
  attempts: number;
  createdAt: string;
  lastAttemptedAt?: string;
  nextAttemptAt?: string;
};

export const MAX_STATUS_UPDATE_ATTEMPTS = 5;

const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

export function enqueueStatusUpdate(
  queue: QueuedStatusUpdate[],
  item: Omit<QueuedStatusUpdate, "attempts" | "createdAt" | "id"> & {
    createdAt?: string;
    id?: string;
  }
) {
  const id = item.id ?? `${item.assignmentId}-${item.payload.status}-${Date.now()}`;
  const createdAt = item.createdAt ?? new Date().toISOString();
  const nextItem: QueuedStatusUpdate = {
    assignmentId: item.assignmentId,
    attempts: 0,
    createdAt,
    id,
    payload: item.payload
  };

  return [
    ...queue.filter(
      (queued) =>
        queued.assignmentId !== item.assignmentId ||
        queued.payload.status !== item.payload.status
    ),
    nextItem
  ];
}

export function markStatusUpdateFailed(
  queue: QueuedStatusUpdate[],
  id: string,
  attemptedAt = new Date()
) {
  return queue.map((item) =>
    item.id === id ? withRetryMetadata(item, attemptedAt) : item
  );
}

export function markStatusUpdateRetried(
  queue: QueuedStatusUpdate[],
  id: string,
  attemptedAt = new Date()
) {
  return markStatusUpdateFailed(queue, id, attemptedAt);
}

export function markStatusUpdateExhausted(
  queue: QueuedStatusUpdate[],
  id: string,
  attemptedAt = new Date()
) {
  return queue.map((item) =>
    item.id === id
      ? {
          ...item,
          attempts: MAX_STATUS_UPDATE_ATTEMPTS,
          lastAttemptedAt: attemptedAt.toISOString(),
          nextAttemptAt: undefined
        }
      : item
  );
}

export function dropStatusUpdate(queue: QueuedStatusUpdate[], id: string) {
  return queue.filter((item) => item.id !== id);
}

export function markStatusUpdateSucceeded(
  queue: QueuedStatusUpdate[],
  id: string
) {
  return dropStatusUpdate(queue, id);
}

export function nextStatusUpdate(queue: QueuedStatusUpdate[], now = new Date()) {
  const seenAssignments = new Set<string>();
  return [...queue]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .filter((item) => {
      if (seenAssignments.has(item.assignmentId)) return false;
      seenAssignments.add(item.assignmentId);
      return true;
    })
    .filter((item) => item.attempts < MAX_STATUS_UPDATE_ATTEMPTS)
    .filter((item) => {
      if (!item.nextAttemptAt) {
        return true;
      }

      const nextAttemptAt = new Date(item.nextAttemptAt);

      return (
        Number.isNaN(nextAttemptAt.getTime()) ||
        nextAttemptAt.getTime() <= now.getTime()
      );
    })
    [0];
}

export function shouldRetryStatusUpdate(status?: number) {
  if (status === undefined || status === 0) {
    return true;
  }

  if (status === 408 || status === 429) {
    return true;
  }

  return status >= 500;
}

export function serializeStatusQueue(queue: QueuedStatusUpdate[]) {
  return JSON.stringify(queue);
}

export function parseStatusQueue(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isQueuedStatusUpdate);
  } catch {
    return [];
  }
}

function isQueuedStatusUpdate(value: unknown): value is QueuedStatusUpdate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<QueuedStatusUpdate>;

  return (
    typeof item.assignmentId === "string" &&
    typeof item.attempts === "number" &&
    typeof item.createdAt === "string" &&
    typeof item.id === "string" &&
    typeof item.payload === "object" &&
    item.payload !== null &&
    "status" in item.payload &&
    typeof item.payload.status === "string"
  );
}

function withRetryMetadata(
  item: QueuedStatusUpdate,
  attemptedAt: Date
): QueuedStatusUpdate {
  const attempts = item.attempts + 1;
  const retryDelay = Math.min(
    BASE_RETRY_DELAY_MS * 2 ** Math.max(attempts - 1, 0),
    MAX_RETRY_DELAY_MS
  );

  return {
    ...item,
    attempts,
    lastAttemptedAt: attemptedAt.toISOString(),
    nextAttemptAt: new Date(attemptedAt.getTime() + retryDelay).toISOString()
  };
}
