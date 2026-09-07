import type { ApiAuthInterceptor, RequestOptions } from "./client";
import { requestApi, requestApiResponse } from "./client";
import type { z } from "zod";

let authInterceptor: ApiAuthInterceptor | null = null;

export function setCustomerApiAuth(interceptor: ApiAuthInterceptor | null) {
  authInterceptor = interceptor;
}

export function requestCustomerApi<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {}
) {
  if (!authInterceptor) {
    throw new Error("Customer authentication is not ready.");
  }

  return requestApi(path, schema, {
    ...options,
    auth: authInterceptor
  });
}

export function requestCustomerApiResponse(
  path: string,
  options: RequestOptions = {}
) {
  if (!authInterceptor) {
    throw new Error("Customer authentication is not ready.");
  }

  return requestApiResponse(path, {
    ...options,
    auth: authInterceptor
  });
}
