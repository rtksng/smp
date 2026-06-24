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
    <Suspense fallback={<main className="bg-[#f4fbf5] p-8">Loading login...</main>}>
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
      <main className="bg-[#f4fbf5]">
        <Container className="grid min-h-[calc(100vh-160px)] place-items-center py-10">
          <div className="w-full max-w-md rounded-lg border border-[#cfe9d2] bg-white p-5 shadow-sm shadow-[#287c30]/5 sm:p-6">
            <CustomerLoginForm onSuccess={() => router.replace(nextPath)} />
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
