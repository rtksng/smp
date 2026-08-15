"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  MapPin,
  Package,
  ReceiptText,
  RefreshCcw,
  Truck
} from "lucide-react";
import type { ReactNode } from "react";
import {
  getFriendlyApiErrorMessage,
  isNotFoundApiError
} from "../../lib/api/error-messages";
import { getOrder, type Order } from "../../lib/api/orders";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { ProtectedCustomerRoute } from "../auth/protected-customer-route";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Skeleton } from "../ui/skeleton";

const priceFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

export function OrderSuccessPage({ orderId }: { orderId: string }) {
  return (
    <>
      <Header />
      <main
        className="orderSuccessNoShadows bg-[#f3faf9]"
        data-testid="order-success-main"
      >
        <Container className="py-6 sm:py-8">
          <ProtectedCustomerRoute>
            <OrderSuccessContent orderId={orderId} />
          </ProtectedCustomerRoute>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function OrderSuccessContent({ orderId }: { orderId: string }) {
  const orderQuery = useQuery({
    queryFn: () => getOrder(orderId),
    queryKey: customerQueryKeys.order(orderId)
  });
  const order = orderQuery.data;

  if (orderQuery.isLoading) {
    return <OrderConfirmationSkeleton />;
  }

  if (orderQuery.isError) {
    const isNotFound = isNotFoundApiError(orderQuery.error);

    return (
      <ErrorState
        action={
          isNotFound ? (
            <Button href="/account/orders">Back to orders</Button>
          ) : (
            <RetryButton
              isRetrying={orderQuery.isFetching}
              onRetry={() => orderQuery.refetch()}
            />
          )
        }
        message={
          isNotFound
            ? "We could not find this order in your account."
            : getFriendlyApiErrorMessage(
                orderQuery.error,
                "Unable to load order confirmation."
              )
        }
        title={isNotFound ? "Order not found" : "Unable to load order"}
      />
    );
  }

  if (!order) {
    return null;
  }

  return <OrderConfirmation order={order} />;
}

function OrderConfirmation({ order }: { order: Order }) {
  const placedDate = formatDate(order.placedAt ?? order.createdAt);

  return (
    <section className="grid gap-5 text-sm text-[#2b4946]">
      <article className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#e5f5f3] text-[#0f6f68]">
              <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-[#0f6f68]">
                Order placed
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight text-[#123432] sm:text-3xl">
                Order confirmed
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#607a77]">
                Your order has been saved and is available in your account for
                status tracking.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button href="/products" variant="outline">
              Continue shopping
            </Button>
            <Button href="/account/orders">View orders</Button>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Order number" value={order.orderNumber} />
          <MetricTile label="Date" value={`Placed ${placedDate}`} />
          <MetricTile label="Products" value={formatItemCount(order)} />
          <MetricTile
            label="Amount"
            value={priceFormatter.format(order.totals.grandTotal)}
          />
        </dl>
      </article>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <OrderItems order={order} />
          <DeliveryDetails order={order} />
          <StatusTimeline order={order} />
        </div>

        <aside className="grid h-fit gap-5">
          <PaymentSummary order={order} />
          <OrderStatusCard order={order} />
        </aside>
      </div>
    </section>
  );
}

function OrderItems({ order }: { order: Order }) {
  return (
    <section className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5">
      <SectionHeading
        description={`${formatItemCount(order)} confirmed in this order.`}
        icon={<Package aria-hidden="true" className="h-5 w-5" />}
        title="Order items"
      />

      <div className="mt-4 divide-y divide-[#c4e4e0]">
        {order.items.map((item) => (
          <div
            className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]"
            key={item.id}
          >
            <div className="min-w-0">
              <h3 className="break-words text-sm font-semibold text-[#123432]">
                {item.name}
              </h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#607a77]">
                SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold text-[#607a77]">
                {priceFormatter.format(item.unitPrice)} each
              </p>
              <p className="mt-1 text-base font-semibold text-[#123432]">
                {priceFormatter.format(item.total)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DeliveryDetails({ order }: { order: Order }) {
  const address = order.shippingAddress;

  return (
    <section className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5">
      <SectionHeading
        description="Destination captured when the order was placed."
        icon={<MapPin aria-hidden="true" className="h-5 w-5" />}
        title="Delivery details"
      />

      {address ? (
        <div className="mt-4 rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0f6f68]/5">
          <p className="text-sm font-semibold text-[#123432]">
            {address.fullName}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#607a77]">
            {formatAddressLine(address)}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#607a77]">
            {address.city}, {address.state} {address.pincode}, {address.country}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#607a77]">
            {address.mobileNumber}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-[#fff5f5] p-4 text-sm font-semibold text-[#7a271a]">
          Delivery address is not available for this order.
        </p>
      )}
    </section>
  );
}

function StatusTimeline({ order }: { order: Order }) {
  const entries =
    order.statusHistory.length > 0
      ? order.statusHistory
      : [
          {
            changedById: null,
            createdAt: order.createdAt,
            id: `${order.id}-current-status`,
            note: null,
            status: order.status
          }
        ];

  return (
    <section className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5">
      <SectionHeading
        description="Latest status changes for this order."
        icon={<RefreshCcw aria-hidden="true" className="h-5 w-5" />}
        title="Status timeline"
      />

      <div className="mt-4 grid gap-4">
        {entries.map((entry) => (
          <div className="flex gap-3" key={entry.id}>
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#d8f1ee] text-[#0f6f68]">
              <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#123432]">
                {formatOrderStatus(entry.status)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#607a77]">
                {formatDate(entry.createdAt)}
              </p>
              {entry.note ? (
                <p className="mt-1 text-sm leading-6 text-[#607a77]">
                  {entry.note}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaymentSummary({ order }: { order: Order }) {
  return (
    <section className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5">
      <SectionHeading
        description="Final amount saved for this order."
        icon={<ReceiptText aria-hidden="true" className="h-5 w-5" />}
        title="Payment summary"
      />

      <dl className="mt-4 grid gap-2 text-sm text-[#2b4946]">
        <InfoRow
          label="Method"
          value={formatPaymentMethod(order.paymentMethod)}
        />
        <InfoRow
          label="Payment status"
          value={formatPaymentStatus(order.paymentStatus)}
        />
        <InfoRow
          label="Subtotal"
          value={priceFormatter.format(order.totals.subtotal)}
        />
        <InfoRow
          label="Discount"
          value={formatDiscount(order.totals.discount)}
        />
        <InfoRow
          label="Delivery charge"
          value={priceFormatter.format(order.totals.deliveryCharge)}
        />
        <InfoRow
          label="Tax/GST"
          value={priceFormatter.format(order.totals.tax)}
        />
        <div className="mt-2 flex items-center justify-between gap-4 border-t border-[#c4e4e0] pt-4 text-base font-semibold text-[#123432]">
          <dt>Total</dt>
          <dd>{priceFormatter.format(order.totals.grandTotal)}</dd>
        </div>
      </dl>
    </section>
  );
}

function OrderStatusCard({ order }: { order: Order }) {
  return (
    <section className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5">
      <SectionHeading
        description="Current order and payment state."
        icon={<Truck aria-hidden="true" className="h-5 w-5" />}
        title="Current status"
      />

      <div className="mt-4 grid gap-3">
        <StatusRow
          icon={<Package aria-hidden="true" className="h-4 w-4" />}
          label="Order"
          value={formatOrderStatus(order.status)}
        />
        <StatusRow
          icon={<CreditCard aria-hidden="true" className="h-4 w-4" />}
          label="Payment"
          value={formatPaymentStatus(order.paymentStatus)}
        />
      </div>
    </section>
  );
}

function SectionHeading({
  description,
  icon,
  title
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e5f5f3] text-[#0f6f68]">
        {icon}
      </span>
      <div>
        <h2 className="text-base font-semibold leading-snug text-[#123432]">
          {title}
        </h2>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#607a77]">
          {description}
        </p>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0f6f68]/5">
      <dt className="text-[0.7rem] font-semibold uppercase text-[#607a77]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[#123432]">
        {value}
      </dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#607a77]">{label}</dt>
      <dd className="text-right font-semibold text-[#123432]">{value}</dd>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0f6f68]/5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#0f6f68]">
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold text-[#607a77]">{label}</p>
        <p className="text-sm font-semibold text-[#123432]">{value}</p>
      </div>
    </div>
  );
}

function OrderConfirmationSkeleton() {
  return (
    <section
      aria-label="Loading order confirmation"
      className="grid gap-5"
      role="status"
    >
      <div className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <Skeleton className="h-11 w-11" />
            <div className="grid flex-1 gap-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-full max-w-lg" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-12 w-36" />
            <Skeleton className="h-12 w-28" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-20" key={index} />
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <Skeleton className="h-56" />
          <Skeleton className="h-40" />
          <Skeleton className="h-44" />
        </div>
        <Skeleton className="h-80" />
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatAddressLine(address: NonNullable<Order["shippingAddress"]>) {
  return [address.line1, address.line2].filter(Boolean).join(", ");
}

function formatItemCount(order: Order) {
  const count = order.items.length;

  return `${count} ${count === 1 ? "item" : "items"}`;
}

function formatDiscount(value: number) {
  if (value <= 0) {
    return priceFormatter.format(0);
  }

  return `-${priceFormatter.format(value)}`;
}

function formatOrderStatus(status: Order["status"]) {
  return formatConstantLabel(status);
}

function formatPaymentStatus(status: Order["paymentStatus"]) {
  if (status === "PENDING") {
    return "Payment pending";
  }

  return formatConstantLabel(status);
}

function formatPaymentMethod(method: Order["paymentMethod"]) {
  if (!method) {
    return "Not selected";
  }

  return method === "COD" ? "Cash on delivery" : "Online payment";
}

function formatConstantLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
