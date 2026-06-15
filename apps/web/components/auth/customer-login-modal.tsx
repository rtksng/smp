"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toSafeNextPath } from "../../lib/auth/routes";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { CustomerLoginForm } from "./customer-login-form";

export function CustomerLoginModal() {
  const router = useRouter();
  const closeLogin = useCustomerAuthStore((state) => state.closeLogin);
  const isLoginOpen = useCustomerAuthStore((state) => state.isLoginOpen);
  const loginRedirectTo = useCustomerAuthStore((state) => state.loginRedirectTo);

  useEffect(() => {
    if (!isLoginOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLogin();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeLogin, isLoginOpen]);

  if (!isLoginOpen) {
    return null;
  }

  return (
    <div
      aria-labelledby="customer-login-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#17211f]/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="relative w-full max-w-md rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-2xl shadow-[#0b5cab]/15 sm:p-6">
        <button
          aria-label="Close login"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-lg border border-[#d6e7f8] bg-white text-[#31413d] shadow-sm shadow-[#0b5cab]/5 hover:bg-[#eef3f1]"
          onClick={closeLogin}
          type="button"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        <CustomerLoginForm
          className="[&_h1]:pr-10"
          headingId="customer-login-modal-title"
          onSuccess={() => {
            closeLogin();

            if (loginRedirectTo) {
              router.replace(toSafeNextPath(loginRedirectTo));
            }
          }}
        />
      </div>
    </div>
  );
}
