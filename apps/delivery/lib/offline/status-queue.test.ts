import { describe, expect, test } from "vitest";
import {
  dropStatusUpdate,
  enqueueStatusUpdate,
  markStatusUpdateFailed,
  nextStatusUpdate
} from "./status-queue";

describe("status retry queue", () => {
  test("keeps the newest status update for the same assignment and status", () => {
    const queue = enqueueStatusUpdate([], {
      assignmentId: "assignment-1",
      createdAt: "2026-05-25T10:00:00.000Z",
      id: "first",
      payload: {
        note: "old",
        status: "PICKED_UP"
      }
    });
    const deduped = enqueueStatusUpdate(queue, {
      assignmentId: "assignment-1",
      createdAt: "2026-05-25T10:01:00.000Z",
      id: "second",
      payload: {
        note: "new",
        status: "PICKED_UP"
      }
    });

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("second");
  });

  test("selects the oldest queued update and tracks retry attempts", () => {
    const queue = [
      {
        assignmentId: "assignment-2",
        attempts: 0,
        createdAt: "2026-05-25T10:02:00.000Z",
        id: "later",
        payload: { status: "OUT_FOR_DELIVERY" as const }
      },
      {
        assignmentId: "assignment-1",
        attempts: 0,
        createdAt: "2026-05-25T10:01:00.000Z",
        id: "earlier",
        payload: { status: "PICKED_UP" as const }
      }
    ];
    const retried = markStatusUpdateFailed(queue, "earlier");

    expect(nextStatusUpdate(queue)?.id).toBe("earlier");
    expect(retried.find((item) => item.id === "earlier")?.attempts).toBe(1);
    expect(dropStatusUpdate(queue, "later")).toHaveLength(1);
  });
});
