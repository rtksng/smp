import { Resolver } from "node:dns/promises";
import { request as httpsRequest } from "node:https";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "content-encoding",
  "etag",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const DEFAULT_ADMIN_API_PROXY_TIMEOUT_MS = 30_000;
const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];
const RAILWAY_HOST_SUFFIX = ".up.railway.app";
const RETRYABLE_DNS_ERROR_CODES = new Set(["EAI_AGAIN", "ENOTFOUND"]);

export class AdminApiProxyTimeoutError extends Error {
  constructor() {
    super("Admin API request timed out.");
    this.name = "AdminApiProxyTimeoutError";
  }
}

export class AdminApiProxyNetworkError extends Error {
  constructor() {
    super("Admin API request failed.");
    this.name = "AdminApiProxyNetworkError";
  }
}

type AdminApiProxyErrorContext = {
  method: string;
  path: string;
};

export function buildAdminApiProxyUrl(
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

export function buildAdminApiProxyHeaders(input: Headers) {
  const headers = new Headers();

  input.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

export async function fetchAdminApiProxy(
  upstreamUrl: URL,
  init: RequestInit,
  timeoutMs = DEFAULT_ADMIN_API_PROXY_TIMEOUT_MS
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
        return await fetchAdminApiProxyWithPublicDns(
          upstreamUrl,
          fetchInit,
          timeout.signal
        );
      } catch {
        // Fall through to the sanitized network error below.
      }
    }

    if (timeout.didTimeout()) {
      throw new AdminApiProxyTimeoutError();
    }

    throw new AdminApiProxyNetworkError();
  } finally {
    timeout.cleanup();
  }
}

async function fetchAdminApiProxyWithPublicDns(
  upstreamUrl: URL,
  init: RequestInit,
  signal: AbortSignal
) {
  const resolver = new Resolver();
  resolver.setServers(PUBLIC_DNS_SERVERS);
  const [address] = await resolver.resolve4(upstreamUrl.hostname);

  if (!address) {
    throw new AdminApiProxyNetworkError();
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
    process.env.NODE_ENV !== "production" &&
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

  throw new AdminApiProxyNetworkError();
}

export async function buildAdminApiProxyResponse(upstreamResponse: Response) {
  const status = upstreamResponse.status === 201 ? 200 : upstreamResponse.status;
  const statusText =
    upstreamResponse.status === 201 ? "OK" : upstreamResponse.statusText;
  const body = [204, 205, 304].includes(status)
    ? null
    : new Uint8Array(await upstreamResponse.arrayBuffer());

  return new Response(body, {
    headers: buildAdminApiProxyHeaders(upstreamResponse.headers),
    status,
    statusText
  });
}

export function buildAdminApiProxyErrorResponse(
  error: unknown,
  context: AdminApiProxyErrorContext
) {
  const isTimeout = error instanceof AdminApiProxyTimeoutError;
  const status = isTimeout ? 504 : 502;
  const message = isTimeout
    ? "Admin API request timed out. Try again in a moment."
    : "Unable to reach the admin API. Try again in a moment.";
  const code = isTimeout ? "ADMIN_API_TIMEOUT" : "ADMIN_API_UNAVAILABLE";

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
