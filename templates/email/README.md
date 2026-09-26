# Customer email templates

Twelve customer templates for Surgical Medical Equipment, matching the customer
site's teal palette. Content is deliberately short: one heading, the relevant
details, one main action, and a support contact. No banners, product promotions,
external images, or tracking pixels.

These are local template artifacts. MSG91 template creation, approval, sending,
and API/worker event wiring have not been performed. `msg91TemplateId` remains
null in the manifest until account creation is verified. OTP, admin, and delivery
partner templates are outside this customer email bundle.

## Open the preview

Open [the gallery](customer/preview/index.html) directly in a browser, or run:

```powershell
cd D:\my-work\smp\templates\email
npm ci --ignore-scripts
npm run build
npm test
npm run preview
```

The local server binds only to `127.0.0.1:4177`. The gallery offers all 12
templates, status examples, light/dark mode, and desktop/360px/320px widths.
Links within the preview email are inert; the download links outside it work.
Examples contain fictional names, orders, and reserved example domains.

## Included templates

| Slug suffix (`smp-customer-…`) | Customer event                                            |
| ------------------------------ | --------------------------------------------------------- |
| `welcome`                      | New account, once an email address is available           |
| `account-status`               | Account active, inactive, or blocked                      |
| `order-received`               | New order, distinguishing COD, pending payment, and paid  |
| `order-progress`               | Confirmed, packed, assigned, out for delivery, delivered  |
| `order-cancelled`              | Cancellation, with payment/refund status explained        |
| `payment-result`               | Payment received or failed                                |
| `invoice-ready`                | Invoice available in the customer's account               |
| `return-update`                | Return received, approved, or rejected                    |
| `refund-update`                | Pending, processing, complete, partial, failed, cancelled |
| `quote-received`               | Bulk quote request received                               |
| `quotation-available`          | Initial or revised quotation                              |
| `question-answered`            | Answer to a product question                              |

## Files for MSG91

- `customer/html/`: 12 complete HTML templates with Handlebars variables.
- `customer/text/`: corresponding plain-text versions. These are companion
  artifacts; the documented create API payload does not include a text field.
- `customer/samples/`: named scenarios with complete sample variable objects.
- `customer/manifest.json`: subjects, triggers, source locations, required and
  optional variables, scenario names, and pending provider ID mapping.
- `customer/msg91-create-templates.json`: an array of 12 individual creation
  payloads with `name`, `slug`, `subject`, and `body`.

In MSG91, use Email > Templates > Create Template > HTML & Text Editor. Paste
the relevant HTML and subject, preview with its sample variables, and complete
the template approval flow required by the account. Use the slug in the manifest
as the proposed template identifier and record the actual identifier returned.
List existing templates first to avoid duplicating or overwriting account work.

For API creation, the documented route is `POST
https://control.msg91.com/api/v5/email/templates`. Each array element is one
request body; the array itself is not a documented bulk-create request. This
bundle deliberately contains no account credentials and no sender that can
accidentally deliver sample messages. Template creation is separate from sending.

Sources checked on 7 September 2026:

- [Create HTML Template](https://docs.msg91.com/email/create-new-template)
- [MSG91 Handlebars support](https://msg91.com/help/email/personalize-emails-with-handlebars-in-msg91)
- [Send email with variables](https://docs.msg91.com/email/send-email)

## Variables and future event wiring

Common required variables are `brand_name`, `customer_name`, `site_url`, and
`support_email`. Use the real customer-site origin and support contact from the
business configuration. The current site's example support address is not a
production contact and has not been copied into live configuration.

The manifest lists per-template variables. `items` contains `name`, `quantity`,
`unit_price`, and `line_total`; prices, totals, and dates must be formatted by the
backend. All item and customer text uses escaped `{{variables}}`, never raw HTML.
Optional public notes are omitted when absent. Internal staff notes, raw payment
errors, and audit details must not be placed in customer-facing variables.

Status copy is supplied through `status_label` and `status_message`. Use the
explicit scenario examples as the copy map for their corresponding committed
business states. Do not derive success from a button click or an API request
being accepted. This avoids presenting order creation as paid, return approval
as refunded, or provider submission as completed.

`render.mjs` validates required values, safe site links, and example placeholders
for local rendering. Its default mode rejects the bundled example addresses;
only preview generation opts into them. It is not wired into the production
worker. A future MSG91 sender must perform equivalent validation before sending
the same variables to the provider.

Important integration details:

- Customer registration uses mobile OTP; wait for a usable email and send the
  welcome message once. These templates do not add email login.
- Email order links should point to `/account/orders/:id`, built using the real
  encoded order ID and customer-site origin. Session checks stay in the app.
- Invoice buttons intentionally open the order page. The existing invoice API
  requires authentication and should not be embedded as an unauthenticated
  download link. Send invoice-ready only after the actual invoice is available;
  the current invoice queue log alone does not prove this.
- Quote buttons use `/account/quotes`, which is the current customer route.
  A guest quote requester can sign in with the request's mobile number.
- Record provider IDs and deduplicate by committed event/customer/template when
  the send workflow is implemented. Repeated OTP login or webhook retries must
  not repeat welcome, payment, or refund messages.
- No refund time limit, shipping ETA, discount, or pickup promise is invented.
  Only pass such details when the business workflow actually supplies them.

## Light and dark mode

The HTML contains inline light colours for clients that strip stylesheet rules,
`color-scheme`/`supported-color-schemes` metadata, a `prefers-color-scheme: dark`
stylesheet, and Outlook `[data-ogsc]`/`[data-ogsb]` colour overrides. Both palettes
have explicit text, muted text, background, border, callout, link, and button
colours. The same content is used in both modes.

Some email clients force their own inversion or ignore media queries. The local
preview demonstrates the authored themes, not an inbox compatibility guarantee.
Actual Gmail, Apple Mail, and Outlook inbox checks should follow account import
and an authorized test send. See the [email-client test matrix](https://www.caniemail.com/features/css-at-media-prefers-color-scheme/).

Automated tests cover every sample, supported Handlebars helpers, HTML escaping,
required data, unsafe links, payment/refund wording, and minimum 4.5:1 text
contrast in both palettes. The gallery's manual theme styles are preview-only
and are not included in the MSG91 HTML exports.

## Editing

Change wording and sample states in `catalog.mjs`, shared markup/colours in
`layout.mjs`, and regenerate with `npm run build`. Commit the source and the
generated customer files together. The package is an isolated authoring tool;
it does not change application dependencies or trigger production sends.
