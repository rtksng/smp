declare module "react-native-razorpay" {
  export type RazorpayOptions = {
    amount: number | string;
    currency?: string;
    description?: string;
    key: string;
    name?: string;
    order_id?: string;
    prefill?: {
      contact?: string;
      email?: string;
      name?: string;
    };
    theme?: {
      color?: string;
    };
  };

  export type RazorpayPaymentSuccess = {
    razorpay_order_id?: string;
    razorpay_payment_id: string;
    razorpay_signature?: string;
  };

  const RazorpayCheckout: {
    open: (options: RazorpayOptions) => Promise<RazorpayPaymentSuccess>;
  };

  export default RazorpayCheckout;
}
