import * as SecureStore from "expo-secure-store";
import type { DeliveryApplication } from "../api/types";

const APPLICATION_KEY = "surgical.delivery.application";

export async function storeDeliveryApplication(application: DeliveryApplication) {
  await SecureStore.setItemAsync(APPLICATION_KEY, JSON.stringify(application), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
  });
}

export async function getStoredDeliveryApplication() {
  const value = await SecureStore.getItemAsync(APPLICATION_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as DeliveryApplication;
  } catch {
    return null;
  }
}

export async function clearStoredDeliveryApplication() {
  await SecureStore.deleteItemAsync(APPLICATION_KEY);
}
