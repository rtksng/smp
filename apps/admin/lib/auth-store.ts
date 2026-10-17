"use client";

import { create } from "zustand";
import {
  adminLogin,
  logoutAdminSession,
  refreshAdminSession,
  type AdminSession
} from "./admin-api";

type AdminAuthState = {
  clearSession: () => void;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<AdminSession>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AdminSession | null>;
  restoreSession: () => Promise<void>;
  session: AdminSession | null;
};

// Earlier versions stored the whole session, refresh token included, here.
const LEGACY_STORAGE_KEY = "surgical.admin.auth.session";

// The session lives only in memory. The refresh token is an httpOnly cookie
// the browser sends to the API's admin auth routes, so no page script can read
// it; a reload restores the session from that cookie.
export const useAdminAuthStore = create<AdminAuthState>()((set, get) => ({
  clearSession: () => {
    set({ session: null });
  },
  isHydrated: false,
  login: async (email, password) => {
    const session = await adminLogin(email, password);

    set({ isHydrated: true, session });
    return session;
  },
  logout: async () => {
    try {
      await logoutAdminSession();
    } finally {
      set({ session: null });
    }
  },
  refreshSession: async () => {
    try {
      const session = await refreshAdminSession();

      set({ session });
      return session;
    } catch (error) {
      get().clearSession();
      throw error;
    }
  },
  restoreSession: async () => {
    removeLegacyStoredSession();

    try {
      set({ session: await refreshAdminSession() });
    } catch {
      set({ session: null });
    } finally {
      set({ isHydrated: true });
    }
  },
  session: null
}));

function removeLegacyStoredSession() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private modes; nothing to remove then.
  }
}
