import { Resolver } from "node:dns/promises";
import { request as httpsRequest } from "node:https";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "etag",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "server",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-hikari-trace",
  "x-railway-edge",
  "x-railway-request-id"
]);

const DEFAULT_CUSTOMER_API_PROXY_TIMEOUT_MS = 30_000;
const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];
const RAILWAY_HOST_SUFFIX = ".up.railway.app";
const CUSTOMER_API_VERSION_PATH = "/api/v1";
const RETRYABLE_DNS_ERROR_CODES = new Set(["EAI_AGAIN", "ENOTFOUND"]);

export class CustomerApiProxyTimeoutError extends Error {
  constructor() {
    super("Customer API request timed out.");
    this.name = "CustomerApiProxyTimeoutError";
  }
}

export class CustomerApiProxyNetworkError extends Error {
  constructor() {
    super("Customer API request failed.");
    this.name = "CustomerApiProxyNetworkError";
  }
}

type CustomerApiProxyErrorContext = {
  method: string;
  path: string;
};

export function buildCustomerApiProxyUrl(
  apiBaseUrl: string,
  pathSegments: string[],
  search = ""
) {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const path = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  const url = new URL(path ? `${baseUrl}/${path}` : baseUrl);
  url.search = search;

  return url;
}

export function buildCustomerApiProxyHeaders(input: Headers) {
  const headers = new Headers();

  input.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

export async function fetchCustomerApiProxy(
  upstreamUrl: URL,
  init: RequestInit,
  timeoutMs = DEFAULT_CUSTOMER_API_PROXY_TIMEOUT_MS
) {
  const { signal, ...fetchInit } = init;
  const timeout = createTimeoutSignal(signal, timeoutMs);

  try {
    let requestError: unknown;

    try {
      return await fetch(upstreamUrl, {
        ...fetchInit,
        signal: timeout.signal
      });
    } catch (error) {
      requestError = error;
    }

    if (shouldRetryWithPublicDns(upstreamUrl, requestError)) {
      try {
        return await fetchCustomerApiProxyWithPublicDns(
          upstreamUrl,
          fetchInit,
          timeout.signal
        );
      } catch {
        // Fall through to the sanitized network error below.
      }
    }

    if (timeout.didTimeout()) {
      throw new CustomerApiProxyTimeoutError();
    }

    throw new CustomerApiProxyNetworkError();
  } finally {
    timeout.cleanup();
  }
}

export function normalizeCustomerApiBaseUrl(value: string) {
  const url = new URL(value);
  const normalizedPath = url.pathname.replace(/\/+$/, "");

  url.pathname = normalizedPath.endsWith(CUSTOMER_API_VERSION_PATH)
    ? normalizedPath
    : `${normalizedPath}${CUSTOMER_API_VERSION_PATH}`.replace(/\/\/{2,}/g, "/");

  return url.toString().replace(/\/+$/, "");
}

async function fetchCustomerApiProxyWithPublicDns(
  upstreamUrl: URL,
  init: RequestInit,
  signal: AbortSignal
) {
  const resolver = new Resolver();
  resolver.setServers(PUBLIC_DNS_SERVERS);
  const [address] = await resolver.resolve4(upstreamUrl.hostname);

  if (!address) {
    throw new CustomerApiProxyNetworkError();
  }

  const headers = new Headers(init.headers);
  headers.set("accept-encoding", "identity");
  headers.set("host", upstreamUrl.host);
  const requestHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });
  const body = proxyRequestBody(init.body);

  return new Promise<Response>((resolve, reject) => {
    const request = httpsRequest(
      {
        headers: requestHeaders,
        hostname: address,
        method: init.method,
        path: `${upstreamUrl.pathname}${upstreamUrl.search}`,
        port: upstreamUrl.port || 443,
        servername: upstreamUrl.hostname,
        signal
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          const responseBody = Buffer.concat(chunks);
          const responseHeaders = new Headers();

          for (const [key, value] of Object.entries(response.headers)) {
            if (Array.isArray(value)) {
              value.forEach((item) => responseHeaders.append(key, item));
            } else if (value !== undefined) {
              responseHeaders.set(key, value);
            }
          }

          resolve(
            new Response(responseBody.length > 0 ? responseBody : null, {
              headers: responseHeaders,
              status: response.statusCode ?? 502,
              statusText: response.statusMessage
            })
          );
        });
      }
    );

    request.on("error", reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

function shouldRetryWithPublicDns(upstreamUrl: URL, error: unknown) {
  return (
    upstreamUrl.protocol === "https:" &&
    upstreamUrl.hostname.endsWith(RAILWAY_HOST_SUFFIX) &&
    hasRetryableDnsError(error)
  );
}

function hasRetryableDnsError(error: unknown) {
  let current = error;

  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const code = "code" in current ? current.code : undefined;

    if (typeof code === "string" && RETRYABLE_DNS_ERROR_CODES.has(code)) {
      return true;
    }

    current = current.cause;
  }

  return false;
}

function proxyRequestBody(body: BodyInit | null | undefined) {
  if (body === null || body === undefined) {
    return null;
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }

  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  throw new CustomerApiProxyNetworkError();
}

export async function buildCustomerApiProxyResponse(upstreamResponse: Response) {
  const body = new Uint8Array(await upstreamResponse.arrayBuffer());
  const status = upstreamResponse.status === 201 ? 200 : upstreamResponse.status;
  const statusText =
    upstreamResponse.status === 201 ? "OK" : upstreamResponse.statusText;

  return new Response(body, {
    headers: buildCustomerApiProxyHeaders(upstreamResponse.headers),
    status,
    statusText
  });
}

export function buildCustomerApiProxyErrorResponse(
  error: unknown,
  context: CustomerApiProxyErrorContext
) {
  const isTimeout = error instanceof CustomerApiProxyTimeoutError;
  const status = isTimeout ? 504 : 502;
  const message = isTimeout
    ? "Customer API request timed out. Try again in a moment."
    : "Unable to reach the customer API. Try again in a moment.";
  const code = isTimeout ? "CUSTOMER_API_TIMEOUT" : "CUSTOMER_API_UNAVAILABLE";

  return Response.json(
    {
      data: null,
      error: {
        code,
        message
      },
      meta: {
        method: context.method,
        path: context.path,
        timestamp: new Date().toISOString()
      },
      success: false
    },
    {
      status
    }
  );
}

function createTimeoutSignal(
  inputSignal: AbortSignal | null | undefined,
  timeoutMs: number
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let didTimeout = false;

  const abortFromInput = () => {
    controller.abort();
  };

  if (inputSignal?.aborted) {
    abortFromInput();
  } else {
    inputSignal?.addEventListener("abort", abortFromInput, { once: true });
  }

  if (timeoutMs > 0 && !controller.signal.aborted) {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      inputSignal?.removeEventListener("abort", abortFromInput);
    },
    didTimeout: () => didTimeout,
    signal: controller.signal
  };
}
