import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import {
  logoutDeliverySession,
  requestDeliveryOtp,
  verifyDeliveryOtp
} from "../api/auth";
import type { DeliverySession } from "../api/types";
import {
  clearStoredSession,
  getStoredSession,
  storeSession
} from "./session-store";

type AuthContextValue = {
  accessToken: string | null;
  isReady: boolean;
  requestOtp: (mobileNumber: string) => Promise<void>;
  session: DeliverySession | null;
  signInWithOtp: (input: { mobileNumber: string; otp: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<DeliverySession | null>(null);
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    getStoredSession()
      .then((storedSession) => {
        if (mounted) {
          setSession(storedSession);
        }
      })
      .finally(() => {
        if (mounted) {
          setReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const requestOtp = useCallback(async (mobileNumber: string) => {
    await requestDeliveryOtp(mobileNumber);
  }, []);

  const signInWithOtp = useCallback(
    async (input: { mobileNumber: string; otp: string }) => {
      const nextSession = await verifyDeliveryOtp(input);
      await storeSession(nextSession);
      setSession(nextSession);
    },
    []
  );

  const signOut = useCallback(async () => {
    const refreshToken = session?.tokens.refreshToken;

    await clearStoredSession();
    setSession(null);

    if (refreshToken) {
      await logoutDeliverySession(refreshToken).catch(() => undefined);
    }
  }, [session?.tokens.refreshToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.tokens.accessToken ?? null,
      isReady,
      requestOtp,
      session,
      signInWithOtp,
      signOut
    }),
    [isReady, requestOtp, session, signInWithOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
