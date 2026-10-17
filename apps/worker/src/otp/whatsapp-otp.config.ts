export type WhatsAppOtpConfig =
  | { enabled: false }
  | {
      accessToken: string;
      apiVersion: string;
      // Codes older than this are not sent: the API has already expired them.
      codeTtlSeconds: number;
      enabled: true;
      phoneNumberId: string;
      templateLanguage: string;
      templateName: string;
    };

type Env = Record<string, string | undefined>;

export function loadWhatsAppOtpConfig(env: Env = process.env): WhatsAppOtpConfig {
  if (env.WHATSAPP_OTP_ENABLED !== "true") {
    return { enabled: false };
  }

  const accessToken = requireEnv(env, "WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requireEnv(env, "WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = requireEnv(env, "WHATSAPP_GRAPH_API_VERSION");
  const templateName = requireEnv(env, "WHATSAPP_OTP_TEMPLATE_NAME");
  const codeTtlSeconds = Number(env.OTP_TTL_SECONDS ?? 300);

  if (!/^\d+$/.test(phoneNumberId)) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID must be the numeric phone number ID from Meta, not the phone number"
    );
  }

  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    throw new Error("WHATSAPP_GRAPH_API_VERSION must look like v23.0");
  }

  if (!Number.isInteger(codeTtlSeconds) || codeTtlSeconds <= 0) {
    throw new Error("OTP_TTL_SECONDS must be a positive whole number of seconds");
  }

  return {
    accessToken,
    apiVersion,
    codeTtlSeconds,
    enabled: true,
    phoneNumberId,
    templateLanguage: env.WHATSAPP_OTP_TEMPLATE_LANGUAGE?.trim() || "en_US",
    templateName
  };
}

function requireEnv(env: Env, key: string) {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required when WHATSAPP_OTP_ENABLED=true`);
  }

  return value;
}
