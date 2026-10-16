const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const RETRYABLE_CONFLICTS = new Set(["concurrent_idempotent_requests", "resource_locked"]);
const NON_RETRYABLE_QUOTAS = new Set(["monthly_quota_exceeded"]);

export type ResendEmailMessage = {
  from: string;
  html: string;
  // Resend keeps keys for 24 hours; a retried job reuses the key so a lost
  // response cannot produce a second email.
  idempotencyKey: string;
  replyTo: string | null;
  subject: string;
  tags: Array<{ name: string; value: string }>;
  text: string;
  to: string;
};

export class ResendApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorType: string,
    readonly retryable: boolean
  ) {
    super(`Resend rejected the email (${status} ${errorType}).`);
    this.name = "ResendApiError";
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class ResendEmailClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async send(message: ResendEmailMessage): Promise<{ id: string }> {
    let response: Response;

    try {
      response = await this.fetchImpl(RESEND_EMAILS_URL, {
        body: JSON.stringify({
          from: message.from,
          html: message.html,
          reply_to: message.replyTo ?? undefined,
          subject: message.subject,
          tags: message.tags,
          text: message.text,
          to: [message.to]
        }),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey
        },
        method: "POST",
        signal: AbortSignal.timeout(15_000)
      });
    } catch (error) {
      // Network failures and timeouts are retried; the idempotency key keeps
      // a request that did reach Resend from sending twice.
      throw new ResendApiError(0, error instanceof Error ? error.name : "network_error", true);
    }

    const body = (await response.json().catch(() => null)) as
      | { id?: unknown; message?: unknown; name?: unknown }
      | null;

    if (response.ok && typeof body?.id === "string" && body.id.length > 0) {
      return { id: body.id };
    }

    const errorType =
      typeof body?.name === "string" && body.name.length > 0 ? body.name : "unknown_error";

    throw new ResendApiError(
      response.status,
      errorType,
      isRetryable(response.status, errorType)
    );
  }
}

function isRetryable(status: number, errorType: string) {
  if (status >= 500 || status === 0) {
    return true;
  }

  if (status === 429) {
    return !NON_RETRYABLE_QUOTAS.has(errorType);
  }

  return status === 409 && RETRYABLE_CONFLICTS.has(errorType);
}
