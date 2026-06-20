import * as SecureStore from "expo-secure-store";
import type { DeliverySession } from "../api/types";

const SESSION_KEY = "surgical.delivery.session.v1";

export async function getStoredSession() {
  const value = await SecureStore.getItemAsync(SESSION_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as DeliverySession;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function storeSession(session: DeliverySession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  });
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
