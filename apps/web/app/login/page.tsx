import { CustomerLoginPage } from "../../components/auth/customer-login-page";
import { buildPrivateMetadata } from "../../lib/seo/metadata";

export const metadata = buildPrivateMetadata({
  description:
    "Sign in with mobile OTP to access cart, checkout, orders, and saved account details.",
  path: "/login",
  title: "Customer Login"
});

export default function CustomerLoginRoute() {
  return <CustomerLoginPage />;
}
