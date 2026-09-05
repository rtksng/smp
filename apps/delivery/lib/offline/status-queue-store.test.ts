import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueStatusUpdate, markStatusUpdateRetried, markStatusUpdateSucceeded } from "./status-queue";
import { clearStatusQueue, loadStatusQueue, updateStatusQueue } from "./status-queue-store";

const storage = vi.hoisted(() => ({ value: null as string | null, failNextWrite: false }));
vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "device-only",
  getItemAsync: async () => storage.value,
  deleteItemAsync: async () => { storage.value = null; },
  setItemAsync: async (_key: string, value: string) => {
    if (storage.failNextWrite) {
      storage.failNextWrite = false;
      throw new Error("Storage unavailable");
    }
    storage.value = value;
  }
}));

const item = (id: string) => ({ id, assignmentId: id, payload: { status: "ACCEPTED" as const } });

describe("persistent delivery status queue", () => {
  beforeEach(async () => { await clearStatusQueue(); storage.failNextWrite = false; });

  it("retains concurrent enqueues and updates arriving while an earlier request completes", async () => {
    await Promise.all(["first", "second"].map((id) => updateStatusQueue((queue) => enqueueStatusUpdate(queue, item(id)))));
    expect((await loadStatusQueue()).map((update) => update.id)).toEqual(["first", "second"]);
    await Promise.all([
      updateStatusQueue((queue) => enqueueStatusUpdate(queue, item("third"))),
      updateStatusQueue((queue) => markStatusUpdateSucceeded(queue, "first"))
    ]);
    expect((await loadStatusQueue()).map((update) => update.id)).toEqual(["second", "third"]);
  });

  it("does not resurrect a discarded queue when an in-flight request fails", async () => {
    await updateStatusQueue((queue) => enqueueStatusUpdate(queue, item("first")));
    await clearStatusQueue();
    await updateStatusQueue((queue) => markStatusUpdateRetried(queue, "first"));
    expect(await loadStatusQueue()).toEqual([]);
  });

  it("allows future writes after a storage failure", async () => {
    storage.failNextWrite = true;
    await expect(updateStatusQueue((queue) => enqueueStatusUpdate(queue, item("first")))).rejects.toThrow("Storage unavailable");
    await updateStatusQueue((queue) => enqueueStatusUpdate(queue, item("second")));
    expect((await loadStatusQueue()).map((update) => update.id)).toEqual(["second"]);
  });
});
