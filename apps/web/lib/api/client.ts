import { z } from "zod";

type QueryValue = boolean | number | string | null | undefined;
export type QueryParams = Record<string, QueryValue>;

type ApiRequestOptions = RequestInit & {
  auth?: ApiAuthInterceptor;
  query?: QueryParams;
  skipAuthRefresh?: boolean;
  tokenOverride?: string;
};

type ApiAuthInterceptor = {
  clearSession: () => void;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
};

const apiUrlSchema = z.string().url();

const metaSchema = z.object({
  method: z.string(),
  path: z.string(),
  timestamp: z.string()
});

export type ApiResponseMeta = z.infer<typeof metaSchema>;

export type ApiSuccessEnvelope<T> = {
  data: T;
  meta: ApiResponseMeta;
  success: true;
};

export type ApiErrorEnvelope = {
  data: null;
  error: {
    code: string;
    message: string | string[];
  };
  meta: ApiResponseMeta;
  success: false;
};

export type ApiResponseEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

const errorEnvelopeSchema = z.object({
  data: z.null(),
  error: z.object({
    code: z.string(),
    message: z.union([z.string(), z.array(z.string())])
  }),
  meta: metaSchema,
  success: z.literal(false)
});

type ApiClientErrorDetails = {
  cause?: unknown;
  payload?: unknown;
  url?: string;
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly details?: ApiClientErrorDetails;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    code = "API_ERROR",
    details?: ApiClientErrorDetails
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;

    if (details) {
      Object.defineProperty(this, "details", {
        enumerable: false,
        value: details
      });
    }
  }
}

export class ApiValidationError extends ApiClientError {
  constructor(
    readonly messages: string[],
    status: number,
    code = "VALIDATION_ERROR",
    details?: ApiClientErrorDetails
  ) {
    super(messages.join(", "), status, code, details);
    this.name = "ApiValidationError";
  }
}

export function buildApiUrl(path: string, query?: QueryParams) {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`${baseUrl}/${normalizedPath}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export async function requestApi<T>(
  path: string,
  dataSchema: z.ZodType<T>,
  options: ApiRequestOptions = {}
) {
  const { auth, query, headers, skipAuthRefresh, tokenOverride, ...init } = options;
  const accessToken = tokenOverride ?? auth?.getAccessToken() ?? null;
  const requestUrl = buildApiUrl(path, query);
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      cache: "no-store",
      ...init,
      headers: buildHeaders(headers, init.body, accessToken)
    });
  } catch (error) {
    logApiDevelopmentWarning("Network request failed", {
      error,
      method: init.method ?? "GET",
      path,
      url: requestUrl.toString()
    });

    throw new ApiClientError(
      "Unable to reach the customer API. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
      {
        cause: error,
        url: requestUrl.toString()
      }
    );
  }

  if (response.status === 401 && auth && !skipAuthRefresh) {
    try {
      const refreshedAccessToken = await auth.refreshAccessToken();

      if (refreshedAccessToken) {
        return requestApi(path, dataSchema, {
          ...options,
          skipAuthRefresh: true,
          tokenOverride: refreshedAccessToken
        });
      }
    } catch {
      auth.clearSession();
    }

    auth.clearSession();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);
  const successEnvelopeSchema = z.object({
    data: dataSchema,
    meta: metaSchema,
    success: z.literal(true)
  });
  const successEnvelope = successEnvelopeSchema.safeParse(payload);

  if (response.ok && successEnvelope.success) {
    return successEnvelope.data.data;
  }

  const errorEnvelope = errorEnvelopeSchema.safeParse(payload);

  if (errorEnvelope.success) {
    const message = errorEnvelope.data.error.message;
    const messages = Array.isArray(message) ? message : [message];
    const code = normalizeErrorCode(
      response.status,
      errorEnvelope.data.error.code,
      messages
    );

    if (code === "VALIDATION_ERROR") {
      throw new ApiValidationError(messages, response.status, code, {
        payload,
        url: requestUrl.toString()
      });
    }

    throw new ApiClientError(messages.join(", "), response.status, code, {
      payload,
      url: requestUrl.toString()
    });
  }

  if (!response.ok) {
    throw new ApiClientError(
      response.statusText || "Customer API request failed.",
      response.status
    );
  }

  logApiDevelopmentWarning("Response schema mismatch", {
    payload,
    path,
    status: response.status,
    url: requestUrl.toString()
  });

  throw new ApiClientError("Customer API response did not match the expected schema.", 500);
}

function getApiBaseUrl() {
  const parsed = apiUrlSchema.safeParse(process.env.NEXT_PUBLIC_API_URL);

  if (!parsed.success) {
    throw new ApiClientError(
      "NEXT_PUBLIC_API_URL must be set to the customer API base URL.",
      0,
      "CONFIGURATION_ERROR"
    );
  }

  return parsed.data.replace(/\/+$/, "");
}

function buildHeaders(
  input: HeadersInit | undefined,
  body: BodyInit | null | undefined,
  accessToken?: string | null
) {
  const headers = new Headers(input);

  if (
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

function normalizeErrorCode(status: number, code: string, messages: string[]) {
  if (status === 400 && messages.length > 1) {
    return "VALIDATION_ERROR";
  }

  return code;
}

function logApiDevelopmentWarning(message: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.warn("[web-api]", message, details);
}
