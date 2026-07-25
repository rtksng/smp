import * as SecureStore from "expo-secure-store";
import { customerSessionSchema, type CustomerSession } from "../api/schemas";

const SESSION_KEY = "surgical.customer.session.v1";

export async function getStoredSession() {
  try {
    const value = await SecureStore.getItemAsync(SESSION_KEY);

    if (!value) {
      return null;
    }

    return customerSessionSchema.parse(JSON.parse(value));
  } catch {
    await clearStoredSession().catch(() => undefined);
    return null;
  }
}

export async function storeSession(session: CustomerSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  });
}

export async function clearStoredSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
