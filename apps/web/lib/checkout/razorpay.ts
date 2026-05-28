export type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  amount: number;
  contact?: string;
  currency: "INR";
  description: string;
  key: string;
  name: string;
  orderId: string;
  prefillName?: string;
};

type RazorpayOptions = {
  amount: number;
  currency: "INR";
  description: string;
  handler: (response: RazorpaySuccessResponse) => void;
  key: string;
  modal: {
    ondismiss: () => void;
  };
  name: string;
  order_id: string;
  prefill: {
    contact?: string;
    name?: string;
  };
  theme: {
    color: string;
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
    };
  }
}

const RAZORPAY_CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

export async function openRazorpayCheckout({
  amount,
  contact,
  currency,
  description,
  key,
  name,
  orderId,
  prefillName
}: RazorpayCheckoutOptions) {
  await loadRazorpayScript();

  return new Promise<RazorpaySuccessResponse>((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Razorpay checkout could not be initialized."));
      return;
    }

    const checkout = new window.Razorpay({
      amount,
      currency,
      description,
      handler: resolve,
      key,
      modal: {
        ondismiss: () => reject(new Error("Payment was cancelled."))
      },
      name,
      order_id: orderId,
      prefill: {
        contact,
        name: prefillName
      },
      theme: {
        color: "#006d77"
      }
    });

    checkout.open();
  });
}

function loadRazorpayScript() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Razorpay checkout is available only in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`
  );

  if (existingScript?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const script = existingScript ?? document.createElement("script");

    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));

    if (!existingScript) {
      document.body.appendChild(script);
    }
  });
}
