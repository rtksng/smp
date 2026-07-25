import * as SecureStore from "expo-secure-store";
import {
  parseStatusQueue,
  serializeStatusQueue,
  type QueuedStatusUpdate
} from "./status-queue";

const STATUS_QUEUE_KEY = "surgical.delivery.status.queue";

export async function loadStatusQueue() {
  return parseStatusQueue(await SecureStore.getItemAsync(STATUS_QUEUE_KEY));
}

export async function saveStatusQueue(queue: QueuedStatusUpdate[]) {
  if (queue.length === 0) {
    await clearStatusQueue();
    return;
  }

  await SecureStore.setItemAsync(STATUS_QUEUE_KEY, serializeStatusQueue(queue), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  });
}

export async function clearStatusQueue() {
  await SecureStore.deleteItemAsync(STATUS_QUEUE_KEY);
}
