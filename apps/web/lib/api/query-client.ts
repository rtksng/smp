import {
  MutationCache,
  QueryCache,
  QueryClient
} from "@tanstack/react-query";
import { ApiClientError } from "./client";

export const API_QUERY_STALE_TIME_MS = 60_000;

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

export function shouldRetryApiFailure(failureCount: number, error: unknown) {
  if (failureCount >= 2) {
    return false;
  }

  if (error instanceof ApiClientError) {
    if (error.status === 0) {
      return true;
    }

    return retryableStatuses.has(error.status);
  }

  return failureCount < 1;
}

export function createWebQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: shouldRetryApiFailure
      },
      queries: {
        refetchOnWindowFocus: false,
        retry: shouldRetryApiFailure,
        staleTime: API_QUERY_STALE_TIME_MS
      }
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        logQueryError("Mutation failed", mutation.options.mutationKey, error);
      }
    }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        logQueryError("Query failed", query.queryHash, error);
      }
    })
  });
}

function logQueryError(
  message: string,
  key: string | readonly unknown[] | undefined,
  error: unknown
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.warn("[web-api]", message, {
    error,
    key
  });
}
