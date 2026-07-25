import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import {
  type DeliveryOtpRequest,
  logoutDeliverySession,
  requestDeliveryOtp,
  refreshDeliveryToken,
  verifyDeliveryOtp
} from "../api/auth";
import { ApiError, setUnauthorizedHandler } from "../api/client";
import type { DeliverySession } from "../api/types";
import {
  clearStoredSession,
  getStoredSession,
  storeSession
} from "./session-store";
import { clearStatusQueue } from "../offline/status-queue-store";

type AuthContextValue = {
  accessToken: string | null;
  isReady: boolean;
  refreshSession: () => Promise<void>;
  requestOtp: (mobileNumber: string) => Promise<DeliveryOtpRequest>;
  session: DeliverySession | null;
  signInWithOtp: (input: { mobileNumber: string; otp: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<DeliverySession | null>(null);
  const [isReady, setReady] = useState(false);
  const sessionRef = useRef<DeliverySession | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const setActiveSession = useCallback((nextSession: DeliverySession | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const expireSession = useCallback(async () => {
    await Promise.all([clearStoredSession(), clearStatusQueue()]);
    setActiveSession(null);
  }, [setActiveSession]);

  const refreshSession = useCallback(async () => {
    const currentSession = sessionRef.current;

    if (!currentSession) {
      return;
    }

    if (!shouldRefresh(currentSession.tokens.accessTokenExpiresAt)) {
      return;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshToken = currentSession.tokens.refreshToken;
    const refreshPromise = refreshDeliveryToken(refreshToken)
      .then(async (refreshed) => {
        if (sessionRef.current?.tokens.refreshToken !== refreshToken) {
          return;
        }

        const nextSession = {
          ...currentSession,
          tokens: refreshed.tokens
        };
        await storeSession(nextSession);
        setActiveSession(nextSession);
      })
      .catch(async (error: unknown) => {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          await expireSession();
        }
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [expireSession, setActiveSession]);

  useEffect(() => {
    let mounted = true;

    getStoredSession()
      .then(async (storedSession) => {
        if (!mounted) {
          return;
        }

        if (storedSession && isExpired(storedSession.tokens.refreshTokenExpiresAt)) {
          await expireSession();
          if (mounted) {
            setReady(true);
          }
          return;
        }

        setActiveSession(storedSession);
        setReady(true);

        if (
          storedSession &&
          shouldRefresh(storedSession.tokens.accessTokenExpiresAt)
        ) {
          void refreshSession();
        }
      })
      .catch(() => {
        if (mounted) {
          setActiveSession(null);
          setReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [expireSession, refreshSession, setActiveSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void expireSession();
    });

    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const expiresAt = new Date(session.tokens.accessTokenExpiresAt).getTime();
    const refreshAt = Number.isFinite(expiresAt)
      ? expiresAt - Date.now() - 60_000
      : 1_000;
    const timer = setTimeout(
      () => {
        void refreshSession();
      },
      Math.max(refreshAt, 1_000)
    );

    return () => clearTimeout(timer);
  }, [refreshSession, session]);

  const requestOtp = useCallback(async (mobileNumber: string) => {
    return requestDeliveryOtp(mobileNumber);
  }, []);

  const signInWithOtp = useCallback(
    async (input: { mobileNumber: string; otp: string }) => {
      const nextSession = await verifyDeliveryOtp(input);
      await storeSession(nextSession);
      setActiveSession(nextSession);
    },
    [setActiveSession]
  );

  const signOut = useCallback(async () => {
    const refreshToken = session?.tokens.refreshToken;

    await clearStoredSession();
    await clearStatusQueue();
    setActiveSession(null);

    if (refreshToken) {
      await logoutDeliverySession(refreshToken).catch(() => undefined);
    }
  }, [session?.tokens.refreshToken, setActiveSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.tokens.accessToken ?? null,
      isReady,
      refreshSession,
      requestOtp,
      session,
      signInWithOtp,
      signOut
    }),
    [isReady, refreshSession, requestOtp, session, signInWithOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function isExpired(expiresAt: string) {
  const timestamp = new Date(expiresAt).getTime();
  return Number.isNaN(timestamp) || timestamp <= Date.now();
}

function shouldRefresh(expiresAt: string) {
  const timestamp = new Date(expiresAt).getTime();
  return Number.isNaN(timestamp) || timestamp - Date.now() <= 60_000;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
