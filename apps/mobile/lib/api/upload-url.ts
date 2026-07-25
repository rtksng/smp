import { getApiBaseUrl } from "./client";

export function resolveMediaUrl(value: string) {
  try {
    const url = new URL(value);
    const apiUrl = new URL(getApiBaseUrl());

    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      url.protocol = apiUrl.protocol;
      url.host = apiUrl.host;
    }

    return url.toString();
  } catch {
    const apiUrl = new URL(getApiBaseUrl());
    return new URL(value.replace(/^\/+/, ""), `${apiUrl.origin}/`).toString();
  }
}
