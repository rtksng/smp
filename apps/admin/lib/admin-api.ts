export type ApiEnvelope<T> =
  | {
      data: T;
      meta: {
        method: string;
        path: string;
        timestamp: string;
      };
      success: true;
    }
  | {
      data: null;
      error: {
        code: string;
        message: string | string[];
      };
      meta: {
        method: string;
        path: string;
        timestamp: string;
      };
      success: false;
    };

export type AdminProfile = {
  email: string;
  firstName: string;
  id: string;
  lastName: string | null;
  permissions: string[];
  role: {
    code: string;
    name: string;
  };
};

export type AdminTokenSet = {
  accessToken: string;
  accessTokenExpiresAt: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  refreshTokenExpiresInSeconds: number;
  tokenType: "Bearer";
};

export type AdminSession = {
  admin: AdminProfile;
  tokens: AdminTokenSet;
};

export type AdminLoginResponse = {
  admin: AdminProfile;
  tokens: AdminTokenSet;
};

type AdminRefreshResponse = {
  tokens: AdminTokenSet;
};

type AdminApiAuth = {
  clearSession: () => void;
  getSession: () => AdminSession | null;
  refreshSession: () => Promise<AdminSession | null>;
};

type QueryValue = boolean | number | string | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export type AdminApiRequestOptions = RequestInit & {
  auth?: AdminApiAuth;
  query?: QueryParams;
  skipAuthRefresh?: boolean;
  tokenOverride?: string;
};

type AdminApiClientOptions = {
  clearSession: () => void;
  getSession: () => AdminSession | null;
  setSession: (session: AdminSession) => void;
};

const REFRESH_SKEW_MS = 30_000;
const BROWSER_API_PROXY_BASE_PATH = "/api/v1";
const BROWSER_PROXY_HOST_SUFFIXES = [".up.railway.app"];

export class AdminApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "AdminApiClientError";
  }
}

export class AdminAuthRequiredError extends Error {
  constructor() {
    super("Admin session is required.");
    this.name = "AdminAuthRequiredError";
  }
}

export function buildAdminApiUrl(path: string, query?: QueryParams) {
  const baseUrl = getAdminApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`${baseUrl}/${normalizedPath}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export function getAdminApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!configuredUrl) {
    throw new AdminApiClientError(
      "NEXT_PUBLIC_API_URL must be set to the admin API base URL.",
      0,
      "CONFIGURATION_ERROR"
    );
  }

  try {
    const apiBaseUrl = new URL(configuredUrl).toString().replace(/\/+$/, "");

    if (shouldUseBrowserApiProxy(apiBaseUrl)) {
      return new URL(BROWSER_API_PROXY_BASE_PATH, window.location.origin)
        .toString()
        .replace(/\/+$/, "");
    }

    return apiBaseUrl;
  } catch {
    throw new AdminApiClientError(
      "NEXT_PUBLIC_API_URL must be a valid URL.",
      0,
      "CONFIGURATION_ERROR"
    );
  }
}

export async function adminLogin(email: string, password: string) {
  const data = await rawAdminRequest<AdminLoginResponse>("/auth/admin/login", {
    body: JSON.stringify({ email, password }),
    method: "POST"
  });

  return {
    admin: data.admin,
    tokens: data.tokens
  };
}

export function refreshAdminTokens(refreshToken: string) {
  return rawAdminRequest<AdminRefreshResponse>("/auth/admin/refresh", {
    body: JSON.stringify({ refreshToken }),
    method: "POST"
  }).then((data) => data.tokens);
}

export async function logoutAdminSession(refreshToken: string) {
  await rawAdminRequest("/auth/admin/logout", {
    body: JSON.stringify({ refreshToken }),
    method: "POST"
  });
}

export async function requestAdminApi<T>(
  path: string,
  options: AdminApiRequestOptions = {}
): Promise<T> {
  const {
    auth,
    headers,
    query,
    skipAuthRefresh,
    tokenOverride,
    ...init
  } = options;
  let session = auth?.getSession() ?? null;

  if (auth && !session) {
    throw new AdminAuthRequiredError();
  }

  if (auth && session && shouldRefresh(session)) {
    session = await auth.refreshSession();
  }

  const accessToken = tokenOverride ?? session?.tokens.accessToken ?? null;
  const response = await fetchAdminApi(buildAdminApiUrl(path, query), {
    ...init,
    headers: buildHeaders(headers, init.body, accessToken)
  });

  if (response.status === 401 && auth && !skipAuthRefresh) {
    try {
      const refreshedSession = await auth.refreshSession();

      if (refreshedSession) {
        return requestAdminApi<T>(path, {
          ...options,
          skipAuthRefresh: true,
          tokenOverride: refreshedSession.tokens.accessToken
        });
      }
    } catch {
      auth.clearSession();
    }

    auth.clearSession();
  }

  return parseEnvelope<T>(response);
}

export class AdminApiClient {
  constructor(private readonly options: AdminApiClientOptions) {}

  async login(email: string, password: string) {
    const session = await adminLogin(email, password);
    this.options.setSession(session);

    return session;
  }

  async logout() {
    const session = this.options.getSession();

    if (!session) {
      this.options.clearSession();
      return;
    }

    try {
      await logoutAdminSession(session.tokens.refreshToken);
    } finally {
      this.options.clearSession();
    }
  }

  request<T>(path: string, init: AdminApiRequestOptions = {}) {
    return requestAdminApi<T>(path, {
      ...init,
      auth: {
        clearSession: this.options.clearSession,
        getSession: this.options.getSession,
        refreshSession: () => this.refreshSession()
      }
    });
  }

  private async refreshSession() {
    const session = this.options.getSession();

    if (!session) {
      this.options.clearSession();
      return null;
    }

    try {
      const tokens = await refreshAdminTokens(session.tokens.refreshToken);
      const nextSession = {
        ...session,
        tokens
      };
      this.options.setSession(nextSession);

      return nextSession;
    } catch (error) {
      this.options.clearSession();
      throw error;
    }
  }
}

function shouldRefresh(session: AdminSession) {
  return (
    new Date(session.tokens.accessTokenExpiresAt).getTime() - Date.now() <=
    REFRESH_SKEW_MS
  );
}

function rawAdminRequest<T = unknown>(path: string, init: RequestInit) {
  return fetchAdminApi(buildAdminApiUrl(path), {
    ...init,
    headers: buildHeaders(init.headers, init.body)
  }).then((response) => parseEnvelope<T>(response));
}

async function fetchAdminApi(url: URL, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new AdminApiClientError(
      "Unable to reach the admin API. Make sure the backend is running and try again.",
      0,
      "NETWORK_ERROR"
    );
  }
}

function shouldUseBrowserApiProxy(apiBaseUrl: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const hostname = new URL(apiBaseUrl).hostname;

    return BROWSER_PROXY_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
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

async function parseEnvelope<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !envelope?.success) {
    const message = envelope?.success === false ? envelope.error.message : response.statusText;
    const normalizedMessage = Array.isArray(message) ? message.join(", ") : message;

    throw new AdminApiClientError(
      normalizedMessage || "Admin API request failed.",
      response.status,
      envelope?.success === false ? envelope.error.code : undefined
    );
  }

  return envelope.data;
}
