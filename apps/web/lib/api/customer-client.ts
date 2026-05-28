import { z } from "zod";
import { useCustomerAuthStore } from "../stores/auth-store";
import { requestApi } from "./client";

export function requestCustomerApi<T>(
  path: string,
  dataSchema: z.ZodType<T>,
  options: Parameters<typeof requestApi<T>>[2] = {}
) {
  return requestApi(path, dataSchema, {
    ...options,
    auth: {
      clearSession: () => useCustomerAuthStore.getState().clearSession(),
      getAccessToken: () =>
        useCustomerAuthStore.getState().session?.tokens.accessToken ?? null,
      refreshAccessToken: async () => {
        const session = await useCustomerAuthStore.getState().refreshSession();

        return session?.tokens.accessToken ?? null;
      }
    }
  });
}
