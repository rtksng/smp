import * as SecureStore from "expo-secure-store";
import {
  parseStatusQueue,
  serializeStatusQueue,
  type QueuedStatusUpdate
} from "./status-queue";

const STATUS_QUEUE_KEY = "surgical.delivery.status.queue";
let pendingWrite: Promise<unknown> = Promise.resolve();

export function updateStatusQueue(update: (queue: QueuedStatusUpdate[]) => QueuedStatusUpdate[]) {
  const operation = pendingWrite.then(async () => {
    const queue = update(await loadStatusQueue());
    await writeStatusQueue(queue);
    return queue;
  });
  pendingWrite = operation.catch(() => undefined);
  return operation;
}

export async function loadStatusQueue() {
  return parseStatusQueue(await SecureStore.getItemAsync(STATUS_QUEUE_KEY));
}

export async function saveStatusQueue(queue: QueuedStatusUpdate[]) {
  await updateStatusQueue(() => queue);
}

async function writeStatusQueue(queue: QueuedStatusUpdate[]) {
  if (queue.length === 0) {
    await SecureStore.deleteItemAsync(STATUS_QUEUE_KEY);
    return;
  }

  await SecureStore.setItemAsync(STATUS_QUEUE_KEY, serializeStatusQueue(queue), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  });
}

export async function clearStatusQueue() {
  await updateStatusQueue(() => []);
}
