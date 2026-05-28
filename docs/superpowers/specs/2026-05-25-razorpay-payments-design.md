# Razorpay Payments Design

## Goal

Build a focused NestJS payments module for Razorpay online payments while keeping COD status separate and preserving the same customer REST API surface for the customer website and future customer mobile app.

## Scope

This feature adds only backend API and database support. It does not add frontend payment UI, a delivery partner web app, mobile apps, or worker-driven webhook processing.

## Architecture

`apps/api/src/modules/payments` owns gateway integration and payment state transitions. `OrdersService` continues to create orders and initial pending `Payment` rows, but Razorpay order creation, payment verification, webhook processing, and refund placeholder creation live in `PaymentsService`.

The module contains:

- `PaymentsController`: customer-authenticated Razorpay create-order and verify endpoints, plus a public webhook endpoint.
- `PaymentsService`: ownership checks, state validation, transaction-wrapped payment/order updates, signature verification, webhook persistence, and idempotency.
- `RazorpayClient`: small Node `fetch` client using Basic Auth and environment values.
- DTOs: class-validator request validation and Swagger response documentation.

## Database

Existing `Payment`, `PaymentWebhook`, and `Refund` models are reused. The schema adds:

- `Payment.providerOrderId` unique constraint for Razorpay order idempotency.
- `Payment.providerPaymentId` unique constraint for duplicate successful payment prevention.
- `Payment.providerAmountPaise` integer field for storing Razorpay amounts in paise.
- `PaymentWebhook.providerEventId` nullable unique field for duplicate webhook deliveries.
- `PaymentWebhook.rawPayload` text field for exact signed request body retention.

Nullable unique columns are acceptable because PostgreSQL permits multiple null values.

## Endpoint Behavior

`POST /api/v1/payments/razorpay/create-order` requires a customer JWT. It accepts only an `orderId`, loads that customer's non-deleted order, finds the existing `ONLINE` payment row, rejects cancelled or already-paid orders, rejects invalid order states, derives amount in paise from `Order.grandTotal`, creates or reuses a Razorpay order, and persists the returned provider order id.

`POST /api/v1/payments/razorpay/verify` requires a customer JWT. It accepts `orderId`, `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. It loads the customer's own order/payment, verifies the signature server-side with `RAZORPAY_KEY_SECRET`, confirms the provider order id matches the stored payment, validates amount in paise against the database total, prevents duplicate successful payments, updates `Payment` to `PAID`, updates `Order.paymentStatus` to `PAID`, and moves the order from `CREATED` to `CONFIRMED`.

`POST /api/v1/payments/razorpay/webhook` is public but requires a valid `x-razorpay-signature` over the raw request body using `RAZORPAY_WEBHOOK_SECRET`. It stores raw and parsed payload in `PaymentWebhook` before processing supported events. Duplicate event ids return safely without repeating state changes.

## State Rules

Online payment success is recognized only from a valid signature or valid webhook. The frontend never decides payment state.

COD payments remain `PENDING` after order creation. This module does not mark COD as paid or failed.

Refund support is a placeholder service method that writes a `Refund` row with `PENDING` status after validating order/payment ownership at the service boundary. It does not call Razorpay refund APIs yet.

## Error Handling

The module uses Nest HTTP exceptions and the existing global response/error envelope. Signature mismatch returns unauthorized. Missing order/payment records return not found. Invalid state, wrong payment method, amount mismatch, duplicate payment attempts, and invalid provider ids return bad request or conflict depending on the state.

## Verification

Tests cover:

- create-order ownership scoping
- invalid order state rejection
- verify signature success and failure
- duplicate successful payment prevention
- webhook invalid signature rejection
- webhook idempotency

Final repository verification runs lint, typecheck, and build.
