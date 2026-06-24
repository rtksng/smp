"use client";

import { HeroUIProvider } from "@heroui/system";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { CustomerLoginModal } from "../components/auth/customer-login-modal";
import { RouteTransitionProgress } from "../components/ui/route-transition-progress";
import { createWebQueryClient } from "../lib/api/query-client";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState<QueryClient>(createWebQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        <Suspense fallback={null}>
          <RouteTransitionProgress />
        </Suspense>
        {children}
        <CustomerLoginModal />
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
