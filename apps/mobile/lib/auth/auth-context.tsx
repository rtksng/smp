import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import {
  logoutCustomer,
  refreshCustomerSession,
  requestCustomerOtp,
  verifyCustomerOtp,
  type OtpRequest
} from "../api/auth";
import { setCustomerApiAuth } from "../api/customer-client";
import type { CustomerSession } from "../api/schemas";
import {
  clearStoredSession,
  getStoredSession,
  storeSession
} from "./session-store";

type AuthContextValue = {
  isReady: boolean;
  requestOtp: (mobileNumber: string) => Promise<OtpRequest>;
  session: CustomerSession | null;
  signInWithOtp: (mobileNumber: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isReady, setReady] = useState(false);
  const sessionRef = useRef<CustomerSession | null>(null);
  const refreshRef = useRef<Promise<string | null> | null>(null);

  const applySession = useCallback(async (nextSession: CustomerSession | null) => {
    if (nextSession) {
      await storeSession(nextSession);
    } else {
      await clearStoredSession().catch(() => undefined);
    }

    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const clearSession = useCallback(async () => {
    await applySession(null);
  }, [applySession]);

  const refreshAccessToken = useCallback(async () => {
    if (refreshRef.current) {
      return refreshRef.current;
    }

    const currentSession = sessionRef.current;

    if (!currentSession) {
      return null;
    }

    refreshRef.current = refreshCustomerSession(currentSession)
      .then(async (nextSession) => {
        await applySession(nextSession);
        return nextSession.tokens.accessToken;
      })
      .catch(async () => {
        await clearSession();
        return null;
      })
      .finally(() => {
        refreshRef.current = null;
      });

    return refreshRef.current;
  }, [applySession, clearSession]);

  useEffect(() => {
    setCustomerApiAuth({
      clearSession,
      getAccessToken: () => sessionRef.current?.tokens.accessToken ?? null,
      refreshAccessToken
    });

    let mounted = true;

    getStoredSession()
      .then(async (storedSession) => {
        if (!storedSession) {
          return null;
        }

        sessionRef.current = storedSession;

        try {
          return await refreshCustomerSession(storedSession);
        } catch {
          await clearStoredSession();
          return null;
        }
      })
      .then(async (restoredSession) => {
        if (!mounted) {
          return;
        }

        sessionRef.current = restoredSession;
        setSession(restoredSession);

        if (restoredSession) {
          await storeSession(restoredSession);
        }
      })
      .catch(async () => {
        if (mounted) {
          sessionRef.current = null;
          setSession(null);
        }
        await clearStoredSession().catch(() => undefined);
      })
      .finally(() => {
        if (mounted) {
          setReady(true);
        }
      });

    return () => {
      mounted = false;
      setCustomerApiAuth(null);
    };
  }, [clearSession, refreshAccessToken]);

  const signInWithOtp = useCallback(
    async (mobileNumber: string, otp: string) => {
      const nextSession = await verifyCustomerOtp(mobileNumber, otp);
      await applySession(nextSession);
    },
    [applySession]
  );

  const signOut = useCallback(async () => {
    const refreshToken = sessionRef.current?.tokens.refreshToken;
    await clearSession();

    if (refreshToken) {
      await logoutCustomer(refreshToken).catch(() => undefined);
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      requestOtp: requestCustomerOtp,
      session,
      signInWithOtp,
      signOut
    }),
    [isReady, session, signInWithOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = React.use(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
