import Constants from "expo-constants";
import type { z } from "zod";

type QueryValue = boolean | number | string | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export type ApiAuthInterceptor = {
  clearSession: () => Promise<void> | void;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
};

export type RequestOptions = {
  auth?: ApiAuthInterceptor;
  baseUrl?: string;
  body?: unknown;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: QueryParams;
  skipAuthRefresh?: boolean;
  timeoutMs?: number;
  tokenOverride?: string;
};

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    code = "API_ERROR",
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function buildApiUrl(
  path: string,
  query?: QueryParams,
  baseUrl = getApiBaseUrl()
): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`${normalizedBase}/${normalizedPath}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function requestApi<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {}
): Promise<T> {
  const {
    auth,
    baseUrl,
    body,
    headers,
    method = "GET",
    query,
    skipAuthRefresh,
    timeoutMs = 20_000,
    tokenOverride
  } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const accessToken = tokenOverride ?? auth?.getAccessToken() ?? null;
  const url = buildApiUrl(path, query, baseUrl);
  let response: Response;

  try {
    response = await fetch(url, {
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
      headers: buildHeaders(headers, body, accessToken),
      method,
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new ApiError(
        "The request timed out. Check your connection and try again.",
        0,
        "TIMEOUT_ERROR",
        error
      );
    }

    throw new ApiError(
      "Unable to reach the customer API. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
      error
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 && auth && !skipAuthRefresh) {
    try {
      const refreshedAccessToken = await auth.refreshAccessToken();

      if (refreshedAccessToken) {
        return requestApi(path, schema, {
          ...options,
          skipAuthRefresh: true,
          tokenOverride: refreshedAccessToken
        });
      }
    } catch {
      await auth.clearSession();
    }

    await auth.clearSession();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parsePayload(response);

  if (response.ok) {
    const data = isSuccessEnvelope(payload) ? payload.data : payload;
    const parsed = schema.safeParse(data);

    if (parsed.success) {
      return parsed.data;
    }

    throw new ApiError(
      "Customer API response did not match the expected contract.",
      500,
      "SCHEMA_ERROR",
      parsed.error
    );
  }

  const messages = readErrorMessages(payload);
  const code =
    response.status === 400 && messages.length > 1
      ? "VALIDATION_ERROR"
      : readErrorCode(payload);

  throw new ApiError(
    messages.join(", ") || response.statusText || "Request failed.",
    response.status,
    code,
    payload
  );
}

export function getApiBaseUrl() {
  const configured =
    process.env.EXPO_PUBLIC_API_URL?.trim() ||
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();

  return configured || getDevelopmentApiBaseUrl(process.env.EXPO_OS);
}

export function getDevelopmentApiBaseUrl(platform?: string) {
  return platform === "ios"
    ? "http://localhost:4000/api/v1"
    : "http://10.0.2.2:4000/api/v1";
}

function buildHeaders(
  input: Record<string, string> | undefined,
  body: unknown,
  accessToken: string | null
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...input
  };

  if (!(body instanceof FormData) && body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function parsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ApiError(
      "Server returned an unreadable response.",
      response.status,
      "INVALID_RESPONSE",
      error
    );
  }
}

function isSuccessEnvelope(value: unknown): value is {
  data: unknown;
  success: true;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    value.success === true &&
    "data" in value
  );
}

function readErrorMessages(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "message" in value.error
  ) {
    const message = value.error.message;

    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === "string");
    }

    if (typeof message === "string") {
      return [message];
    }
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return [value.message];
  }

  return [];
}

function readErrorCode(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "code" in value.error &&
    typeof value.error.code === "string"
  ) {
    return value.error.code;
  }

  return "API_ERROR";
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}
