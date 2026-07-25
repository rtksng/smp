import type {
  RazorpayOptions,
  RazorpayPaymentSuccess
} from "react-native-razorpay";

export function normalizeRazorpayContact(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || undefined;
}

export async function openRazorpayCheckout(
  options: RazorpayOptions
): Promise<RazorpayPaymentSuccess> {
  try {
    const module = await import("react-native-razorpay");

    if (typeof module.default?.open !== "function") {
      throw new Error("Razorpay native checkout is unavailable.");
    }

    return await module.default.open(options);
  } catch (error) {
    if (
      error instanceof Error &&
      !/native checkout is unavailable/i.test(error.message) &&
      !/native module|turbomodule|rnr?razorpay/i.test(error.message)
    ) {
      throw error;
    }

    throw new Error(
      "Online payment requires the installed iOS or Android app build. Use COD in Expo Go."
    );
  }
}
