"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Download,
  MapPin,
  RotateCcw
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  getFriendlyApiErrorMessage,
  isNotFoundApiError
} from "../../lib/api/error-messages";
import { customerQueryKeys } from "../../lib/api/query-keys";
import {
  canDownloadOrderInvoice,
  downloadOrderInvoiceHtml,
  getOrder,
  listCustomerOrders,
  type Order
} from "../../lib/api/orders";
import { Button } from "../ui/button";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Skeleton, TableSkeleton } from "../ui/skeleton";
import {
  AccountInfoGrid,
  AccountSection,
  AccountSectionHeader,
  AccountStatusBadge,
  CustomerAccountShell,
  PrivateEmptyState
} from "./customer-account-shell";

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

export function AccountOrders() {
  const ordersQuery = useQuery({
    queryFn: () => listCustomerOrders(),
    queryKey: customerQueryKeys.orders(1, 20)
  });
  const orders = ordersQuery.data?.items ?? [];
  const latestOrder = orders[0];

  return (
    <CustomerAccountShell
      activePath="/account/orders"
      description="Track order status, payment status, totals, and invoices."
      title="Orders"
    >
      {ordersQuery.isLoading ? <OrdersListSkeleton /> : null}

      {ordersQuery.isError ? (
        <ErrorState
          action={<RetryButton onRetry={() => ordersQuery.refetch()} />}
          message={getFriendlyApiErrorMessage(
            ordersQuery.error,
            "Unable to load orders."
          )}
          title="Unable to load orders"
        />
      ) : null}

      {ordersQuery.isSuccess ? (
        <AccountInfoGrid
          items={[
            {
              label: "Total orders",
              value: String(ordersQuery.data.pagination.total)
            },
            {
              label: "Latest",
              value: latestOrder
                ? formatDate(latestOrder.placedAt ?? latestOrder.createdAt)
                : "-"
            },
            {
              label: "Latest status",
              value: latestOrder ? formatOrderStatus(latestOrder.status) : "-"
            },
            {
              label: "Latest total",
              value: latestOrder
                ? priceFormatter.format(latestOrder.totals.grandTotal)
                : "-"
            }
          ]}
        />
      ) : null}

      {ordersQuery.isSuccess && orders.length === 0 ? (
        <PrivateEmptyState
          action={<Button href="/products">Shop products</Button>}
          description="Your customer orders will appear here after checkout."
          title="No orders yet"
        />
      ) : null}

      {orders.length > 0 ? (
        <AccountSection>
          <AccountSectionHeader
            description="Review each order, status, payment state, and invoice availability."
            title="Order history"
          />
          <OrderList orders={orders} />
        </AccountSection>
      ) : null}
    </CustomerAccountShell>
  );
}

export function AccountOrderDetail({ orderId }: { orderId: string }) {
  const orderQuery = useQuery({
    queryFn: () => getOrder(orderId),
    queryKey: customerQueryKeys.order(orderId)
  });
  const order = orderQuery.data;
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  async function handleDownloadInvoice() {
    if (!order) {
      return;
    }

    try {
      setIsDownloadingInvoice(true);
      setInvoiceError(null);
      await downloadOrderInvoiceHtml(order);
    } catch (error) {
      setInvoiceError(
        getFriendlyApiErrorMessage(error, "Unable to download invoice.")
      );
    } finally {
      setIsDownloadingInvoice(false);
    }
  }

  return (
    <CustomerAccountShell
      activePath="/account/orders"
      description="Review order items, delivery address, payment details, timeline, and invoice."
      title={order ? `Order ${order.orderNumber}` : "Order detail"}
    >
      {orderQuery.isLoading ? <OrderDetailSkeleton /> : null}

      {orderQuery.isError ? (
        <ErrorState
          action={
            isNotFoundApiError(orderQuery.error) ? (
              <Button href="/account/orders">Back to orders</Button>
            ) : (
              <RetryButton onRetry={() => orderQuery.refetch()} />
            )
          }
          message={
            isNotFoundApiError(orderQuery.error)
              ? "We could not find this order in your account."
              : getFriendlyApiErrorMessage(
                  orderQuery.error,
                  "Unable to load order."
                )
          }
          title={
            isNotFoundApiError(orderQuery.error)
              ? "Order not found"
              : "Unable to load order"
          }
        />
      ) : null}

      {order ? (
        <>
          <AccountInfoGrid
            items={[
              { label: "Order number", value: order.orderNumber },
              {
                label: "Date",
                value: formatDate(order.placedAt ?? order.createdAt)
              },
              { label: "Status", value: formatOrderStatus(order.status) },
              {
                label: "Total",
                value: priceFormatter.format(order.totals.grandTotal)
              }
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-5">
              <OrderItems order={order} />
              <DeliveryAddress order={order} />
              <StatusTimeline order={order} />
            </div>
            <aside className="grid h-fit gap-5">
              <PaymentDetails order={order} />
              <AccountSection>
                <AccountSectionHeader
                  description="Invoice and quick actions for this order."
                  title="Actions"
                />
                <div className="mt-4 grid gap-3">
                  {canDownloadOrderInvoice(order) ? (
                    <Button
                      disabled={isDownloadingInvoice}
                      onClick={handleDownloadInvoice}
                    >
                      <Download aria-hidden="true" className="h-4 w-4" />
                      {isDownloadingInvoice
                        ? "Downloading..."
                        : "Download invoice"}
                    </Button>
                  ) : null}
                  <Button disabled variant="outline">
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    Reorder coming soon
                  </Button>
                  <Button href="/account/orders" variant="ghost">
                    Back to orders
                  </Button>
                  {invoiceError ? (
                    <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]">
                      {invoiceError}
                    </p>
                  ) : null}
                </div>
              </AccountSection>
            </aside>
          </div>
        </>
      ) : null}
    </CustomerAccountShell>
  );
}

function OrderList({ orders }: { orders: Order[] }) {
  return (
    <>
      <div className="mt-4 grid gap-3 md:hidden">
        {orders.map((order) => (
          <article
            className="grid gap-3 rounded-lg border border-[#d6e7f8] bg-[#f4f9ff] p-4 shadow-sm shadow-[#0b5cab]/5"
            key={order.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  className="break-words text-sm font-bold text-[#0b5cab] hover:text-[#094f94]"
                  href={`/account/orders/${order.id}`}
                >
                  {order.orderNumber}
                </Link>
                <p className="mt-1 text-xs font-bold text-[#52677f]">
                  {formatDate(order.placedAt ?? order.createdAt)}
                </p>
              </div>
              <strong className="shrink-0 text-right text-sm text-[#12314f]">
                {priceFormatter.format(order.totals.grandTotal)}
              </strong>
            </div>
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={order.status} />
              <AccountStatusBadge>
                {formatPaymentStatus(order.paymentStatus)}
              </AccountStatusBadge>
            </div>
            <Button
              className="w-full"
              href={`/account/orders/${order.id}`}
              variant="outline"
            >
              View details
            </Button>
          </article>
        ))}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-lg border border-[#d6e7f8] shadow-sm shadow-[#0b5cab]/5 md:block">
        <table className="w-full min-w-[760px] border-collapse bg-white text-left">
          <thead className="bg-[#f4f9ff] text-xs uppercase text-[#52677f]">
            <tr>
              <th className="px-4 py-3 font-bold">Order</th>
              <th className="px-4 py-3 font-bold">Date</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Payment</th>
              <th className="px-4 py-3 text-right font-bold">Total</th>
              <th className="px-4 py-3 font-bold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d6e7f8]">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-4">
                  <Link
                    className="font-bold text-[#0b5cab] hover:text-[#094f94]"
                    href={`/account/orders/${order.id}`}
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-[#52677f]">
                  {formatDate(order.placedAt ?? order.createdAt)}
                </td>
                <td className="px-4 py-4">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-4">
                  <AccountStatusBadge>
                    {formatPaymentStatus(order.paymentStatus)}
                  </AccountStatusBadge>
                </td>
                <td className="px-4 py-4 text-right text-sm font-bold text-[#12314f]">
                  {priceFormatter.format(order.totals.grandTotal)}
                </td>
                <td className="px-4 py-4">
                  <Button href={`/account/orders/${order.id}`} variant="outline">
                    View details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OrderItems({ order }: { order: Order }) {
  return (
    <AccountSection>
      <AccountSectionHeader
        description={`${formatItemCount(order)} included in this order.`}
        title="Items"
      />

      <div className="mt-4 divide-y divide-[#d6e7f8]">
        {order.items.map((item) => (
          <div
            className="grid gap-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto]"
            key={item.id}
          >
            <div>
              <p className="text-sm font-bold text-[#12314f]">{item.name}</p>
              <p className="mt-1 text-xs font-bold text-[#52677f]">
                SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs font-bold text-[#52677f]">
                {priceFormatter.format(item.unitPrice)} each
              </p>
              <p className="mt-1 text-base font-bold text-[#12314f]">
                {priceFormatter.format(item.total)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </AccountSection>
  );
}

function DeliveryAddress({ order }: { order: Order }) {
  const address = order.shippingAddress;

  return (
    <AccountSection>
      <AccountSectionHeader
        description="Destination saved when the order was placed."
        title="Delivery address"
      />

      {address ? (
        <div className="mt-4 rounded-lg border border-[#d6e7f8] bg-[#f4f9ff] p-4 shadow-sm shadow-[#0b5cab]/5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#edf6ff] text-[#0b5cab]">
              <MapPin aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#12314f]">
                {address.fullName}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#52677f]">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.city},{" "}
                {address.state} {address.pincode}, {address.country}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#52677f]">
                {address.mobileNumber}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-[#fff5f5] p-4 text-sm font-bold text-[#7a271a]">
          Delivery address is not available for this order.
        </p>
      )}
    </AccountSection>
  );
}

function PaymentDetails({ order }: { order: Order }) {
  return (
    <AccountSection>
      <AccountSectionHeader
        description="Method, payment state, and final payable total."
        title="Payment details"
      />
      <dl className="mt-4 grid gap-2 text-sm text-[#12314f]">
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
        <InfoRow label="Discount" value={formatDiscount(order.totals.discount)} />
        <InfoRow
          label="Delivery charge"
          value={priceFormatter.format(order.totals.deliveryCharge)}
        />
        <InfoRow label="Tax/GST" value={priceFormatter.format(order.totals.tax)} />
        <div className="mt-2 flex items-center justify-between border-t border-[#d6e7f8] pt-4 text-base font-bold text-[#12314f]">
          <dt>Total</dt>
          <dd>{priceFormatter.format(order.totals.grandTotal)}</dd>
        </div>
      </dl>
    </AccountSection>
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
    <AccountSection>
      <AccountSectionHeader
        description="Latest status updates captured for this order."
        title="Status timeline"
      />
      <div className="mt-4 grid gap-4">
        {entries.map((entry) => (
          <div className="flex gap-3" key={entry.id}>
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#edf6ff] text-[#0b5cab]">
              <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#12314f]">
                {formatOrderStatus(entry.status)}
              </p>
              <p className="mt-1 text-xs font-bold text-[#52677f]">
                {formatDate(entry.createdAt)}
              </p>
              {entry.note ? (
                <p className="mt-1 text-sm leading-6 text-[#52677f]">
                  {entry.note}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </AccountSection>
  );
}

function OrderStatusBadge({ status }: { status: Order["status"] }) {
  return (
    <AccountStatusBadge tone={status === "CANCELLED" ? "neutral" : "success"}>
      {formatOrderStatus(status)}
    </AccountStatusBadge>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#52677f]">{label}</dt>
      <dd className="text-right font-bold text-[#12314f]">{value}</dd>
    </div>
  );
}

function OrdersListSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-20" key={index} />
        ))}
      </div>
      <AccountSection>
        <TableSkeleton columns={5} rows={4} />
      </AccountSection>
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-20" key={index} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function formatItemCount(order: Order) {
  const count = order.items.length;

  return `${count} ${count === 1 ? "product" : "products"}`;
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
