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
import { AppState } from "react-native";
import { ApiError } from "../api/client";
import { updateAssignmentStatus } from "../api/delivery";
import { useAuth } from "../auth/auth-context";
import {
  MAX_STATUS_UPDATE_ATTEMPTS,
  dropStatusUpdate,
  enqueueStatusUpdate,
  markStatusUpdateExhausted,
  markStatusUpdateRetried,
  markStatusUpdateSucceeded,
  nextStatusUpdate,
  shouldRetryStatusUpdate,
  type QueuedStatusUpdate
} from "./status-queue";
import { loadStatusQueue, updateStatusQueue } from "./status-queue-store";

type StatusQueueContextValue = {
  discardUpdate: (id: string) => Promise<void>;
  enqueueUpdate: (
    item: Omit<QueuedStatusUpdate, "attempts" | "createdAt" | "id"> & {
      createdAt?: string;
      id?: string;
    }
  ) => Promise<QueuedStatusUpdate[]>;
  queuedUpdates: QueuedStatusUpdate[];
  retryUpdate: (id: string) => Promise<void>;
};

const StatusQueueContext = createContext<StatusQueueContextValue | null>(null);

export function StatusQueueProvider({ children }: PropsWithChildren) {
  const { accessToken, isReady } = useAuth();
  const netInfo = useNetInfo();
  const queryClient = useQueryClient();
  const drainingRef = useRef(false);
  const [queuedUpdates, setQueuedUpdates] = useState<QueuedStatusUpdate[]>([]);
  const [retryTick, setRetryTick] = useState(0);

  const persistQueue = useCallback(async (update: (queue: QueuedStatusUpdate[]) => QueuedStatusUpdate[]) => {
    const queue = await updateStatusQueue(update);
    setQueuedUpdates(queue);
    return queue;
  }, []);

  const enqueueUpdate = useCallback(
    async (
      item: Omit<QueuedStatusUpdate, "attempts" | "createdAt" | "id"> & {
        createdAt?: string;
        id?: string;
      }
    ) => {
      return persistQueue((queue) => enqueueStatusUpdate(queue, item));
    },
    [persistQueue]
  );

  const discardUpdate = useCallback(
    async (id: string) => {
      await persistQueue((queue) => dropStatusUpdate(queue, id));
    },
    [persistQueue]
  );

  const retryUpdate = useCallback(
    async (id: string) => {
      await persistQueue(
        (queue) => queue.map((item) =>
          item.id === id
            ? {
                ...item,
                attempts: 0,
                lastAttemptedAt: undefined,
                nextAttemptAt: undefined
              }
            : item
        )
      );
      setRetryTick((value) => value + 1);
    },
    [persistQueue]
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!accessToken) {
      setQueuedUpdates([]);
      return;
    }

    loadStatusQueue()
      .then(setQueuedUpdates)
      .catch(() => undefined);
  }, [accessToken, isReady]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        setRetryTick((value) => value + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      !isReady ||
      !accessToken ||
      netInfo.isConnected !== true ||
      netInfo.isInternetReachable === false ||
      queuedUpdates.length === 0 ||
      drainingRef.current
    ) {
      return;
    }

    const next = nextStatusUpdate(queuedUpdates);

    if (!next) {
      const nextAttemptAt = queuedUpdates
        .filter(
          (item) =>
            item.attempts < MAX_STATUS_UPDATE_ATTEMPTS && item.nextAttemptAt
        )
        .map((item) => new Date(item.nextAttemptAt ?? "").getTime())
        .filter(Number.isFinite)
        .sort((left, right) => left - right)[0];

      if (nextAttemptAt !== undefined) {
        const timer = setTimeout(
          () => setRetryTick((value) => value + 1),
          Math.max(nextAttemptAt - Date.now(), 1_000)
        );
        return () => clearTimeout(timer);
      }

      return;
    }

    drainingRef.current = true;
    updateAssignmentStatus(accessToken, next.assignmentId, next.payload)
      .then(async () => {
        await persistQueue((queue) => markStatusUpdateSucceeded(queue, next.id));
        await queryClient.invalidateQueries({ queryKey: ["delivery-assignments"] });
        await queryClient.invalidateQueries({
          queryKey: ["delivery-assignment", next.assignmentId]
        });
        await queryClient.invalidateQueries({ queryKey: ["delivery-dashboard"] });
        await queryClient.invalidateQueries({ queryKey: ["delivery-cash"] });
      })
      .catch(async (error) => {
        const status = error instanceof ApiError ? error.status : undefined;
        await persistQueue((queue) => shouldRetryStatusUpdate(status)
          ? markStatusUpdateRetried(queue, next.id)
          : markStatusUpdateExhausted(queue, next.id));
      })
      .finally(() => {
        drainingRef.current = false;
        setRetryTick((value) => value + 1);
      });
  }, [
    accessToken,
    isReady,
    netInfo.isConnected,
    netInfo.isInternetReachable,
    persistQueue,
    queryClient,
    retryTick,
    queuedUpdates
  ]);

  return (
    <StatusQueueContext.Provider
      value={{ discardUpdate, enqueueUpdate, queuedUpdates, retryUpdate }}
    >
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
