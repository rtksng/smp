"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { AdminSessionProvider } from "../lib/admin-session";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 45_000
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AdminSessionProvider>{children}</AdminSessionProvider>
    </QueryClientProvider>
  );
}
