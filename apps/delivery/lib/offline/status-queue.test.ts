import { describe, expect, test } from "vitest";
import {
  MAX_STATUS_UPDATE_ATTEMPTS,
  dropStatusUpdate,
  enqueueStatusUpdate,
  markStatusUpdateRetried,
  markStatusUpdateExhausted,
  markStatusUpdateSucceeded,
  markStatusUpdateFailed,
  nextStatusUpdate,
  parseStatusQueue,
  serializeStatusQueue,
  shouldRetryStatusUpdate
} from "./status-queue";

describe("status retry queue", () => {
  test("never skips a delayed or exhausted transition for the same assignment", () => {
    let queue = enqueueStatusUpdate([], { assignmentId: "one", id: "accept", createdAt: "2026-09-01T10:00:00Z", payload: { status: "ACCEPTED" } });
    queue = enqueueStatusUpdate(queue, { assignmentId: "one", id: "pickup", createdAt: "2026-09-01T10:01:00Z", payload: { status: "PICKED_UP" } });
    queue = enqueueStatusUpdate(queue, { assignmentId: "two", id: "other", createdAt: "2026-09-01T10:02:00Z", payload: { status: "ACCEPTED" } });
    const delayed = markStatusUpdateRetried(queue, "accept", new Date("2026-09-01T10:03:00Z"));
    expect(nextStatusUpdate(delayed, new Date("2026-09-01T10:03:01Z"))?.id).toBe("other");
    expect(nextStatusUpdate(markStatusUpdateExhausted(queue, "accept"))?.id).toBe("other");
    expect(nextStatusUpdate(markStatusUpdateSucceeded(queue, "accept"))?.id).toBe("pickup");
  });
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

  test("removes a queued update after a successful retry", () => {
    const queue = [
      {
        assignmentId: "assignment-1",
        attempts: 1,
        createdAt: "2026-05-25T10:01:00.000Z",
        id: "queued",
        payload: { status: "PICKED_UP" as const }
      },
      {
        assignmentId: "assignment-2",
        attempts: 0,
        createdAt: "2026-05-25T10:02:00.000Z",
        id: "keep",
        payload: { status: "OUT_FOR_DELIVERY" as const }
      }
    ];

    expect(markStatusUpdateSucceeded(queue, "queued")).toEqual([queue[1]]);
  });

  test("increments attempts and keeps the original creation order after retry failure", () => {
    const queue = [
      {
        assignmentId: "assignment-1",
        attempts: 0,
        createdAt: "2026-05-25T10:01:00.000Z",
        id: "queued",
        payload: { status: "PICKED_UP" as const }
      }
    ];

    expect(markStatusUpdateRetried(queue, "queued")).toEqual([
      {
        ...queue[0],
        attempts: 1,
        lastAttemptedAt: expect.any(String),
        nextAttemptAt: expect.any(String)
      }
    ]);
  });

  test("backs off failed updates before selecting them again", () => {
    const queue = [
      {
        assignmentId: "assignment-1",
        attempts: 0,
        createdAt: "2026-05-25T10:01:00.000Z",
        id: "queued",
        payload: { status: "PICKED_UP" as const }
      }
    ];

    const retried = markStatusUpdateRetried(
      queue,
      "queued",
      new Date("2026-05-25T10:02:00.000Z")
    );

    expect(retried[0]?.nextAttemptAt).toBe("2026-05-25T10:02:30.000Z");
    expect(nextStatusUpdate(retried, new Date("2026-05-25T10:02:29.000Z"))).toBeUndefined();
    expect(nextStatusUpdate(retried, new Date("2026-05-25T10:02:30.000Z"))?.id).toBe(
      "queued"
    );
  });

  test("skips exhausted queued updates and permanent client errors", () => {
    const queue = [
      {
        assignmentId: "assignment-1",
        attempts: MAX_STATUS_UPDATE_ATTEMPTS,
        createdAt: "2026-05-25T10:01:00.000Z",
        id: "exhausted",
        payload: { status: "PICKED_UP" as const }
      }
    ];

    expect(nextStatusUpdate(queue)).toBeUndefined();
    expect(shouldRetryStatusUpdate(0)).toBe(true);
    expect(shouldRetryStatusUpdate(408)).toBe(true);
    expect(shouldRetryStatusUpdate(429)).toBe(true);
    expect(shouldRetryStatusUpdate(500)).toBe(true);
    expect(shouldRetryStatusUpdate(400)).toBe(false);
    expect(shouldRetryStatusUpdate(404)).toBe(false);
    expect(shouldRetryStatusUpdate(409)).toBe(false);
    expect(markStatusUpdateExhausted(queue, "exhausted")[0]?.attempts).toBe(
      MAX_STATUS_UPDATE_ATTEMPTS
    );
  });

  test("serializes and parses stored queue values defensively", () => {
    const queue = [
      {
        assignmentId: "assignment-1",
        attempts: 0,
        createdAt: "2026-05-25T10:01:00.000Z",
        id: "queued",
        payload: { status: "PICKED_UP" as const }
      }
    ];

    expect(parseStatusQueue(serializeStatusQueue(queue))).toEqual(queue);
    expect(parseStatusQueue(null)).toEqual([]);
    expect(parseStatusQueue("{bad json")).toEqual([]);
    expect(parseStatusQueue(JSON.stringify({ items: queue }))).toEqual([]);
  });
});
