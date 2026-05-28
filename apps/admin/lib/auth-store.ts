"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  adminLogin,
  logoutAdminSession,
  refreshAdminTokens,
  type AdminSession
} from "./admin-api";

type AdminAuthState = {
  clearSession: () => void;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<AdminSession>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AdminSession | null>;
  session: AdminSession | null;
  setHydrated: () => void;
};

export const ADMIN_AUTH_STORAGE_KEY = "surgical.admin.auth.session";

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      clearSession: () => {
        set({ session: null });
      },
      isHydrated: false,
      login: async (email, password) => {
        const session = await adminLogin(email, password);

        set({ session });
        return session;
      },
      logout: async () => {
        const refreshToken = get().session?.tokens.refreshToken;

        try {
          if (refreshToken) {
            await logoutAdminSession(refreshToken);
          }
        } finally {
          set({ session: null });
        }
      },
      refreshSession: async () => {
        const currentSession = get().session;

        if (!currentSession) {
          return null;
        }

        try {
          const tokens = await refreshAdminTokens(
            currentSession.tokens.refreshToken
          );
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
      session: null,
      setHydrated: () => {
        set({ isHydrated: true });
      }
    }),
    {
      name: ADMIN_AUTH_STORAGE_KEY,
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
