import Constants from "expo-constants";
import type { z } from "zod";

type RequestOptions = {
  accessToken?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  timeoutMs?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const API_BASE_URL = resolveApiBaseUrl();

const DEFAULT_TIMEOUT_MS = 20_000;
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function resolveApiBaseUrl() {
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();
  const fallbackHost =
    process.env.EXPO_OS === "android" ? "10.0.2.2" : "localhost";

  return (
    configuredUrl ?? `http://${fallbackHost}:4000/api/v1`
  ).replace(/\/+$/, "");
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body:
        options.body instanceof FormData
          ? options.body
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      headers: buildHeaders(options),
      method: options.method ?? "GET",
      signal: controller.signal
    });
  } catch (error) {
    throw toNetworkApiError(error);
  } finally {
    clearTimeout(timeout);
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }
    throw new ApiError(readErrorMessage(payload), response.status, payload);
  }

  const data =
    isEnvelope(payload) && payload.success === true && "data" in payload
      ? payload.data
      : payload;

  return schema.parse(data);
}

function toNetworkApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  ) {
    return new ApiError("Request timed out.", 0);
  }

  return new ApiError("Unable to connect to the server.", 0);
}

function buildHeaders(options: RequestOptions) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  return headers;
}

async function parseJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("Server returned an unreadable response.", response.status);
  }
}

function isEnvelope(value: unknown): value is {
  success: boolean;
  data?: unknown;
  error?: { message?: string };
  message?: string;
} {
  return typeof value === "object" && value !== null && "success" in value;
}

function readErrorMessage(payload: unknown) {
  if (isEnvelope(payload)) {
    return payload.error?.message ?? payload.message ?? "Request failed.";
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return "Request failed.";
}
