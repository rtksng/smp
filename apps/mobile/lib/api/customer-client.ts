import type { ApiAuthInterceptor, RequestOptions } from "./client";
import { requestApi } from "./client";
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
