import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { updateAssignmentStatus } from "../api/delivery";
import { useAuth } from "../auth/auth-context";
import {
  dropStatusUpdate,
  enqueueStatusUpdate,
  markStatusUpdateRetried,
  markStatusUpdateSucceeded,
  nextStatusUpdate,
  shouldRetryStatusUpdate,
  type QueuedStatusUpdate
} from "./status-queue";
import { loadStatusQueue, saveStatusQueue } from "./status-queue-store";

type StatusQueueContextValue = {
  enqueueUpdate: (
    item: Omit<QueuedStatusUpdate, "attempts" | "createdAt" | "id"> & {
      createdAt?: string;
      id?: string;
    }
  ) => Promise<QueuedStatusUpdate[]>;
  queuedUpdates: QueuedStatusUpdate[];
};

const StatusQueueContext = createContext<StatusQueueContextValue | null>(null);

export function StatusQueueProvider({ children }: PropsWithChildren) {
  const { accessToken, isReady } = useAuth();
  const netInfo = useNetInfo();
  const queryClient = useQueryClient();
  const drainingRef = useRef(false);
  const [queuedUpdates, setQueuedUpdates] = useState<QueuedStatusUpdate[]>([]);

  const persistQueue = useCallback(async (queue: QueuedStatusUpdate[]) => {
    setQueuedUpdates(queue);
    await saveStatusQueue(queue);
  }, []);

  const enqueueUpdate = useCallback(
    async (
      item: Omit<QueuedStatusUpdate, "attempts" | "createdAt" | "id"> & {
        createdAt?: string;
        id?: string;
      }
    ) => {
      const storedQueue = await loadStatusQueue();
      const nextQueue = enqueueStatusUpdate(storedQueue, item);
      await persistQueue(nextQueue);
      return nextQueue;
    },
    [persistQueue]
  );

  useEffect(() => {
    loadStatusQueue()
      .then(setQueuedUpdates)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (
      !isReady ||
      !accessToken ||
      netInfo.isConnected !== true ||
      queuedUpdates.length === 0 ||
      drainingRef.current
    ) {
      return;
    }

    const next = nextStatusUpdate(queuedUpdates);

    if (!next) {
      return;
    }

    drainingRef.current = true;
    updateAssignmentStatus(accessToken, next.assignmentId, next.payload)
      .then(async () => {
        await persistQueue(markStatusUpdateSucceeded(queuedUpdates, next.id));
        await queryClient.invalidateQueries({ queryKey: ["delivery-assignments"] });
      })
      .catch(async (error) => {
        const status = error instanceof ApiError ? error.status : undefined;
        const nextQueue = shouldRetryStatusUpdate(status)
          ? markStatusUpdateRetried(queuedUpdates, next.id)
          : dropStatusUpdate(queuedUpdates, next.id);

        await persistQueue(nextQueue);
      })
      .finally(() => {
        drainingRef.current = false;
      });
  }, [
    accessToken,
    isReady,
    netInfo.isConnected,
    persistQueue,
    queryClient,
    queuedUpdates
  ]);

  return (
    <StatusQueueContext.Provider value={{ enqueueUpdate, queuedUpdates }}>
      {children}
    </StatusQueueContext.Provider>
  );
}

export function useStatusQueue() {
  const value = useContext(StatusQueueContext);

  if (!value) {
    throw new Error("useStatusQueue must be used inside StatusQueueProvider.");
  }

  return value;
}
