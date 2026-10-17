const GRAPH_API_ORIGIN = "https://graph.facebook.com";
const REQUEST_TIMEOUT_MS = 10_000;

// Meta error codes for throttling and temporary outages. Everything else in a
// 4xx response (bad token, unknown template, number not on WhatsApp, policy
// blocks) will fail the same way on retry.
const RETRYABLE_ERROR_CODES = new Set([
  1, // API unknown
  2, // API service
  4, // Application request limit reached
  80007, // WhatsApp Business Account rate limit
  130429, // Cloud API throughput limit
  131000, // Something went wrong
  131016, // Service unavailable
  131056, // Business and recipient pair rate limit
  133004 // Server temporarily unavailable
]);

export type WhatsAppOtpMessage = {
  code: string;
  // Digits only, country code first, e.g. 919876543210.
  to: string;
};

export type WhatsAppOtpSettings = {
  accessToken: string;
  apiVersion: string;
  phoneNumberId: string;
  templateLanguage: string;
  templateName: string;
};

export class WhatsAppApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | null,
    readonly retryable: boolean
  ) {
    // Meta's error text can echo the recipient number, so it is not kept.
    super(`WhatsApp rejected the message (${status}${code === null ? "" : ` code ${code}`}).`);
    this.name = "WhatsAppApiError";
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class WhatsAppCloudClient {
  constructor(
    private readonly settings: WhatsAppOtpSettings,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  // Sends an authentication template. Meta requires the code both as the body
  // parameter and as the copy-code button parameter.
  async sendOtp(message: WhatsAppOtpMessage): Promise<{ messageId: string }> {
    const { accessToken, apiVersion, phoneNumberId, templateLanguage, templateName } =
      this.settings;
    let response: Response;

    try {
      response = await this.fetchImpl(
        `${GRAPH_API_ORIGIN}/${apiVersion}/${phoneNumberId}/messages`,
        {
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            template: {
              components: [
                {
                  parameters: [{ text: message.code, type: "text" }],
                  type: "body"
                },
                {
                  index: "0",
                  parameters: [{ text: message.code, type: "text" }],
                  sub_type: "url",
                  type: "button"
                }
              ],
              language: { code: templateLanguage },
              name: templateName
            },
            to: message.to,
            type: "template"
          }),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }
      );
    } catch {
      // Network failures and timeouts are retried. A retry after a request
      // that did reach Meta resends the same code, which is harmless.
      throw new WhatsAppApiError(0, null, true);
    }

    const body = (await response.json().catch(() => null)) as {
      error?: { code?: unknown };
      messages?: Array<{ id?: unknown }>;
    } | null;
    const messageId = body?.messages?.[0]?.id;

    if (response.ok && typeof messageId === "string" && messageId.length > 0) {
      return { messageId };
    }

    const code = typeof body?.error?.code === "number" ? body.error.code : null;

    throw new WhatsAppApiError(response.status, code, isRetryable(response.status, code));
  }
}

function isRetryable(status: number, code: number | null) {
  if (status >= 500 || status === 429) {
    return true;
  }

  return code !== null && RETRYABLE_ERROR_CODES.has(code);
}
