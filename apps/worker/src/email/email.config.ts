import { APP_NAMES } from "@surgical/config";

export type CustomerEmailConfig =
  | { enabled: false }
  | {
      apiKey: string;
      brandName: string;
      enabled: true;
      from: string;
      replyTo: string | null;
      siteUrl: string;
      supportEmail: string;
    };

type Env = Record<string, string | undefined>;

export function loadCustomerEmailConfig(env: Env = process.env): CustomerEmailConfig {
  if (env.EMAIL_SENDING_ENABLED !== "true") {
    return { enabled: false };
  }

  const apiKey = requireEnv(env, "RESEND_API_KEY");
  const from = requireEnv(env, "EMAIL_FROM");
  const supportEmail = requireEnv(env, "EMAIL_SUPPORT_ADDRESS");
  const siteUrl = requireEnv(env, "CUSTOMER_SITE_URL");
  const site = new URL(siteUrl);

  if (site.protocol !== "https:" || site.pathname !== "/" || site.search || site.hash) {
    throw new Error("CUSTOMER_SITE_URL must be an HTTPS origin such as https://shop.example.in");
  }

  return {
    apiKey,
    brandName: env.EMAIL_BRAND_NAME?.trim() || APP_NAMES.customerWeb,
    enabled: true,
    from,
    replyTo: env.EMAIL_REPLY_TO?.trim() || supportEmail,
    siteUrl: site.origin,
    supportEmail
  };
}

function requireEnv(env: Env, key: string) {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required when EMAIL_SENDING_ENABLED=true`);
  }

  return value;
}
