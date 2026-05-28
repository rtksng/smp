"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  logoutCustomerSession,
  refreshCustomerTokens,
  requestCustomerOtp,
  verifyCustomerOtp,
  type CustomerOtpRequest,
  type CustomerSession
} from "../api/customer-auth";

type CustomerAuthState = {
  clearSession: () => void;
  closeLogin: () => void;
  isHydrated: boolean;
  isLoginOpen: boolean;
  lastOtpRequest: CustomerOtpRequest | null;
  loginRedirectTo: string | null;
  logout: () => Promise<void>;
  pendingMobileNumber: string | null;
  promptLogin: (redirectTo?: string) => void;
  refreshSession: () => Promise<CustomerSession | null>;
  requestOtp: (mobileNumber: string) => Promise<CustomerOtpRequest>;
  session: CustomerSession | null;
  setHydrated: () => void;
  verifyOtp: (otp: string) => Promise<CustomerSession>;
};

export const CUSTOMER_AUTH_STORAGE_KEY = "surgical.customer.auth.session";

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set, get) => ({
      clearSession: () => {
        set({ session: null });
      },
      closeLogin: () => {
        set({ isLoginOpen: false, loginRedirectTo: null });
      },
      isHydrated: false,
      isLoginOpen: false,
      lastOtpRequest: null,
      loginRedirectTo: null,
      logout: async () => {
        const refreshToken = get().session?.tokens.refreshToken;

        try {
          if (refreshToken) {
            await logoutCustomerSession(refreshToken);
          }
        } finally {
          set({
            isLoginOpen: false,
            loginRedirectTo: null,
            pendingMobileNumber: null,
            session: null
          });
        }
      },
      pendingMobileNumber: null,
      promptLogin: (redirectTo) => {
        set({
          isLoginOpen: true,
          loginRedirectTo: redirectTo ?? null
        });
      },
      refreshSession: async () => {
        const currentSession = get().session;

        if (!currentSession) {
          return null;
        }

        try {
          const tokens = await refreshCustomerTokens(currentSession.tokens.refreshToken);
          const nextSession = {
            ...currentSession,
            tokens
          };

          set({ session: nextSession });
          return nextSession;
        } catch (error) {
          get().clearSession();
          throw error;
        }
      },
      requestOtp: async (mobileNumber) => {
        const otpRequest = await requestCustomerOtp(mobileNumber);

        set({
          lastOtpRequest: otpRequest,
          pendingMobileNumber: otpRequest.mobileNumber
        });

        return otpRequest;
      },
      session: null,
      setHydrated: () => {
        set({ isHydrated: true });
      },
      verifyOtp: async (otp) => {
        const mobileNumber = get().pendingMobileNumber;

        if (!mobileNumber) {
          throw new Error("Request an OTP before verifying.");
        }

        const session = await verifyCustomerOtp(mobileNumber, otp);

        set({
          isLoginOpen: false,
          lastOtpRequest: null,
          loginRedirectTo: null,
          pendingMobileNumber: null,
          session
        });

        return session;
      }
    }),
    {
      name: CUSTOMER_AUTH_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
      partialize: (state) => ({
        session: state.session
      }),
      storage: createJSONStorage(() => window.localStorage)
    }
  )
);
