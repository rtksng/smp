"use client";

import { HeroUIProvider } from "@heroui/system";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { CustomerLoginModal } from "../components/auth/customer-login-modal";
import { createWebQueryClient } from "../lib/api/query-client";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState<QueryClient>(createWebQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        {children}
        <CustomerLoginModal />
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
