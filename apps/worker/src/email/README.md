# Customer emails

Transactional emails to customers, sent through [Resend](https://resend.com).
There are no marketing emails, tracking pixels, or external images.

## How it works

1. After a business change commits, the API calls `CustomerEmailNotifier`
   (`apps/api/src/queues/customer-email.notifier.ts`). The notifier queues a
   `send-customer-email` job on the `customer-email` queue. The job holds a
   typed event (`CustomerEmailEvent` in `packages/types`), the recipient, and a
   `dedupeKey`. Customers without an email address are skipped. A queue failure
   is logged and never fails the API request.
2. Razorpay webhooks are processed in the worker, so
   `payments/payment-webhook.repository.ts` queues the same job for
   captured/failed payments and processed/failed refunds.
3. `CustomerEmailProcessor` validates the job. `CustomerEmailService` then:
   - skips the job if `NotificationLog` already has a `SENT` row for the
     `dedupeKey`;
   - turns the event into template variables (`customer/variables.ts`). This
     step adds the status wording, ₹ amounts, IST dates, and site links;
   - renders HTML and plain text (`customer/render.ts`);
   - sends through Resend with `Idempotency-Key: <dedupeKey>`;
   - records the result in `NotificationLog` (`channel = "email"`,
     `providerRef = "email:<dedupeKey>"`).
4. Transient provider errors (429, 5xx, network) are retried with exponential
   backoff (6 attempts). Permanent errors and invalid content are recorded as
   `FAILED` and are not retried.

The API sends facts (statuses, amounts, ids), never wording. All customer-facing
copy lives in `customer/variables.ts` and `customer/catalog.ts`, so the preview
shows exactly what is sent.

## Templates and triggers

| Template              | Sent when                                                                    | Dedupe key                                     |
| --------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `welcome`             | A customer adds their first email address in their profile                   | `welcome:<customerId>`                         |
| `account-status`      | An admin changes the account status (only on an actual change)               | `account-status:<customerId>:<status>:<time>`  |
| `order-received`      | Checkout or quote order created                                              | `order-received:<orderId>`                     |
| `order-progress`      | Admin confirms or packs an order; order assigned, out for delivery, delivered | `order-progress:<orderId>:<status>[:<assignmentId>]` |
| `order-cancelled`     | Customer or admin cancels                                                    | `order-cancelled:<orderId>`                    |
| `payment-result`      | Online payment verified or captured; payment failed (webhook); COD collected  | `payment-result:<paymentId>:<status>`          |
| `invoice-ready`       | **Not wired yet.** See "Open items"                                           | n/a                                            |
| `return-update`       | Return requested, approved, or rejected                                      | `return-update:<refundId>:<status>`            |
| `refund-update`       | Refund status recorded from Razorpay (API or webhook); cancellation refund rejected | `refund-update:<refundId>:<status>`      |
| `quote-received`      | Quote request saved, sent to the address on the form (guests too)            | `quote-received:<quoteId>`                     |
| `quotation-available` | Quotation sent or revised                                                    | `quotation-available:<quoteId>:<sentAt>`       |
| `question-answered`   | A product question is answered for the first time                            | `question-answered:<questionId>`               |

Some emails are deliberately not sent because another email already covers
the change:

- Online payments: the payment receipt is sent, not a separate "order
  confirmed" email.
- A refund created at cancellation or return: the cancellation or return email
  already covers it.

## Setup

1. In Resend, add and verify a sending domain (SPF and DKIM DNS records).
   Ideally use a subdomain such as `mail.<your-domain>`. Add a DMARC record for
   the parent domain.
2. Create an API key with **sending access** only.
3. Set the worker environment:

   ```bash
   EMAIL_SENDING_ENABLED=true
   RESEND_API_KEY=<resend-sending-key>     # store in your secret manager
   EMAIL_FROM="Surgical Medical Equipment <orders@mail.your-domain.in>"
   EMAIL_SUPPORT_ADDRESS=support@your-domain.in
   CUSTOMER_SITE_URL=https://www.your-domain.in   # HTTPS origin, no path
   EMAIL_REPLY_TO=                          # optional, defaults to the support address
   EMAIL_BRAND_NAME=                        # optional, defaults to "Surgical Medical Equipment"
   ```

   When `EMAIL_SENDING_ENABLED` is not `true`, jobs are consumed and skipped,
   and nothing is sent. When it is `true`, missing settings stop the worker at
   startup instead of failing quietly later.

4. Apply the `NotificationLog.providerRef` index migration with
   `prisma migrate deploy`.

## Preview

```bash
corepack pnpm --filter @surgical/worker email:preview          # http://127.0.0.1:4177
corepack pnpm --filter @surgical/worker email:preview --out tmp/customer-emails.html
```

The gallery renders every template and status from `customer/samples.ts` in
light and dark mode at desktop and mobile widths. It shows the queued event and
the plain-text version. All sample data is fictional, and links in the preview
are inert.

## Changing or adding a template

- Wording: edit `customer/catalog.ts` (layout of each email) or
  `customer/variables.ts` (status wording).
- Shared markup and colours: edit `customer/layout.ts`. Tests check both
  themes for WCAG AA contrast.
- New template: add the key to `CUSTOMER_EMAIL_TEMPLATE_KEYS` and an event
  shape to `CustomerEmailEvent` in `packages/types`. Then add a catalog entry,
  a `buildCustomerEmailVariables` case, a validator case in
  `customer/job-validation.ts`, and samples. Finally call
  `CustomerEmailNotifier` after the change commits, with a stable dedupe key.
- Run `corepack pnpm --filter @surgical/worker test` and check the preview.

The HTML has inline light colours, a `prefers-color-scheme: dark` stylesheet,
and Outlook `[data-ogsc]` overrides. Some clients force their own colours, so
check real Gmail, Apple Mail, and Outlook inboxes with a test send to your own
address before going live.

## Operations

- Delivery history:

  ```sql
  SELECT * FROM "NotificationLog" WHERE channel = 'email' ORDER BY "createdAt" DESC;
  ```

  `payload.emailId` is the Resend email id. `payload.failure` holds the error
  type for failed sends.
- Worker logs `customer-email.sent` and `customer-email.skipped` events with the
  template, dedupe key, and Resend id. Recipient addresses are not logged.
- Failed jobs stay in the `customer-email` queue for inspection. Retrying one
  is safe, because the dedupe key prevents a second email.

## Open items

- **invoice-ready is not wired.** GST invoices are only created when a customer
  or admin first opens the invoice (`InvoicesService.getOrCreateInvoice`). The
  `invoice` queue job does not create one. To send this email, decide when an
  invoice should be issued, for example on payment or confirmation. That
  decision affects GST invoice numbering. Then queue `invoice-ready` right
  after the invoice row is created.
- Profile email addresses are not verified, so a typo sends emails to the
  wrong person. Consider an email verification step before relying on email
  for important notices.
