import type { StatusUpdateInput } from "../api/types";

export type QueuedStatusUpdate = {
  id: string;
  assignmentId: string;
  payload: StatusUpdateInput;
  attempts: number;
  createdAt: string;
};

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
  id: string
) {
  return queue.map((item) =>
    item.id === id
      ? {
          ...item,
          attempts: item.attempts + 1
        }
      : item
  );
}

export function dropStatusUpdate(queue: QueuedStatusUpdate[], id: string) {
  return queue.filter((item) => item.id !== id);
}

export function nextStatusUpdate(queue: QueuedStatusUpdate[]) {
  return [...queue].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  )[0];
}
