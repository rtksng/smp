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
    return await fetch(upstreamUrl, {
      ...fetchInit,
      signal: timeout.signal
    });
  } catch {
    if (timeout.didTimeout()) {
      throw new AdminApiProxyTimeoutError();
    }

    throw new AdminApiProxyNetworkError();
  } finally {
    timeout.cleanup();
  }
}

export async function buildAdminApiProxyResponse(upstreamResponse: Response) {
  const body = new Uint8Array(await upstreamResponse.arrayBuffer());
  const status = upstreamResponse.status === 201 ? 200 : upstreamResponse.status;
  const statusText =
    upstreamResponse.status === 201 ? "OK" : upstreamResponse.statusText;

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
