"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerLoginForm } from "./customer-login-form";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Container } from "../ui/container";
import { toSafeNextPath } from "../../lib/auth/routes";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";

export function CustomerLoginPage() {
  return (
    <Suspense fallback={<main className="bg-[#f5f8f7] p-8">Loading login...</main>}>
      <CustomerLoginContent />
    </Suspense>
  );
}

function CustomerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHydrated = useCustomerAuthStore((state) => state.isHydrated);
  const session = useCustomerAuthStore((state) => state.session);
  const nextPath = toSafeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (isHydrated && session) {
      router.replace(nextPath);
    }
  }, [isHydrated, nextPath, router, session]);

  return (
    <>
      <Header />
      <main className="bg-[#f5f8f7]">
        <Container className="grid min-h-[calc(100vh-160px)] place-items-center py-10">
          <div className="w-full max-w-md rounded-lg border border-[#d8e2df] bg-white p-5 shadow-sm sm:p-6">
            <CustomerLoginForm onSuccess={() => router.replace(nextPath)} />
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
