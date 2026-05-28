"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Package,
  RefreshCcw,
  RotateCcw,
  Truck
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
import { mobileCardListClassName } from "../../lib/responsive/responsive-classes";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Skeleton, TableSkeleton } from "../ui/skeleton";
import { CustomerAccountShell } from "./customer-account-shell";

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

      {ordersQuery.isSuccess && orders.length === 0 ? (
        <EmptyState
          action={<Button href="/products">Shop products</Button>}
          description="Your customer orders will appear here after checkout."
          title="No orders yet"
        />
      ) : null}

      {orders.length > 0 ? <OrderList orders={orders} /> : null}
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
              : getFriendlyApiErrorMessage(orderQuery.error, "Unable to load order.")
          }
          title={
            isNotFoundApiError(orderQuery.error)
              ? "Order not found"
              : "Unable to load order"
          }
        />
      ) : null}

      {order ? (
        <div className="grid gap-5">
          <div className="flex flex-col gap-3 rounded-lg border border-[#d8e2df] bg-[#f8fbfa] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-extrabold text-[#17211f]">
                {order.orderNumber}
              </p>
              <p className="mt-1 text-sm font-bold text-[#687773]">
                Placed {formatDate(order.placedAt ?? order.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={formatOrderStatus(order.status)} />
              <StatusBadge
                label={formatPaymentStatus(order.paymentStatus)}
                tone="payment"
              />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="grid gap-5">
              <OrderItems order={order} />
              <DeliveryAddress order={order} />
              <StatusTimeline order={order} />
            </div>
            <aside className="grid h-fit gap-5">
              <PaymentDetails order={order} />
              <div className="grid gap-3 rounded-lg border border-[#d8e2df] bg-white p-5">
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
            </aside>
          </div>
        </div>
      ) : null}
    </CustomerAccountShell>
  );
}

function OrderList({ orders }: { orders: Order[] }) {
  return (
    <>
      <div className={mobileCardListClassName}>
        {orders.map((order) => (
          <article
            className="grid gap-4 rounded-lg border border-[#d8e2df] bg-white p-4"
            key={order.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  className="break-words font-extrabold text-[#006d77] hover:text-[#084c61]"
                  href={`/account/orders/${order.id}`}
                >
                  {order.orderNumber}
                </Link>
                <p className="mt-1 text-sm font-bold text-[#687773]">
                  {formatDate(order.placedAt ?? order.createdAt)}
                </p>
              </div>
              <strong className="shrink-0 text-right text-sm text-[#17211f]">
                {priceFormatter.format(order.totals.grandTotal)}
              </strong>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={formatOrderStatus(order.status)} />
              <StatusBadge
                label={formatPaymentStatus(order.paymentStatus)}
                tone="payment"
              />
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

      <div className="hidden overflow-x-auto rounded-lg border border-[#d8e2df] md:block">
        <table className="w-full min-w-[760px] border-collapse bg-white text-left">
          <thead className="bg-[#f8fbfa] text-xs uppercase text-[#687773]">
            <tr>
              <th className="px-4 py-3 font-extrabold">Order</th>
              <th className="px-4 py-3 font-extrabold">Date</th>
              <th className="px-4 py-3 font-extrabold">Status</th>
              <th className="px-4 py-3 font-extrabold">Payment</th>
              <th className="px-4 py-3 text-right font-extrabold">Total</th>
              <th className="px-4 py-3 font-extrabold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d8e2df]">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-4">
                  <Link
                    className="font-extrabold text-[#006d77] hover:text-[#084c61]"
                    href={`/account/orders/${order.id}`}
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm font-bold text-[#687773]">
                  {formatDate(order.placedAt ?? order.createdAt)}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge label={formatOrderStatus(order.status)} />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge
                    label={formatPaymentStatus(order.paymentStatus)}
                    tone="payment"
                  />
                </td>
                <td className="px-4 py-4 text-right text-sm font-extrabold text-[#17211f]">
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
    <section className="rounded-lg border border-[#d8e2df] bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
          <Package aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#17211f]">Items</h2>
          <p className="text-sm font-bold text-[#687773]">
            Products included in this order.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {order.items.map((item) => (
          <div
            className="grid gap-3 rounded-lg bg-[#f8fbfa] p-4 md:grid-cols-[1fr_auto]"
            key={item.id}
          >
            <div>
              <p className="font-extrabold text-[#17211f]">{item.name}</p>
              <p className="mt-1 text-sm font-bold text-[#687773]">
                SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm font-bold text-[#687773]">
                {priceFormatter.format(item.unitPrice)} each
              </p>
              <p className="mt-1 font-extrabold text-[#17211f]">
                {priceFormatter.format(item.total)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DeliveryAddress({ order }: { order: Order }) {
  const address = order.shippingAddress;

  return (
    <section className="rounded-lg border border-[#d8e2df] bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
          <Truck aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#17211f]">
            Delivery address
          </h2>
          <p className="text-sm font-bold text-[#687773]">
            Destination saved when the order was placed.
          </p>
        </div>
      </div>

      {address ? (
        <div className="mt-5 rounded-lg bg-[#f8fbfa] p-4 text-sm font-bold leading-6 text-[#687773]">
          <p className="font-extrabold text-[#17211f]">{address.fullName}</p>
          <p className="mt-1">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}, {address.city},{" "}
            {address.state} {address.pincode}, {address.country}
          </p>
          <p className="mt-1">{address.mobileNumber}</p>
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-[#fff5f5] p-4 text-sm font-bold text-[#7a271a]">
          Delivery address is not available for this order.
        </p>
      )}
    </section>
  );
}

function PaymentDetails({ order }: { order: Order }) {
  return (
    <section className="rounded-lg border border-[#d8e2df] bg-white p-5">
      <h2 className="text-lg font-extrabold text-[#17211f]">
        Payment details
      </h2>
      <div className="mt-4 grid gap-2 text-sm text-[#31413d]">
        <InfoRow
          label="Method"
          value={formatPaymentMethod(order.paymentMethod)}
        />
        <InfoRow
          label="Payment status"
          value={formatPaymentStatus(order.paymentStatus)}
        />
        <InfoRow label="Subtotal" value={priceFormatter.format(order.totals.subtotal)} />
        <InfoRow label="Discount" value={priceFormatter.format(order.totals.discount)} />
        <InfoRow
          label="Delivery charge"
          value={priceFormatter.format(order.totals.deliveryCharge)}
        />
        <InfoRow label="Tax/GST" value={priceFormatter.format(order.totals.tax)} />
        <div className="mt-2 flex items-center justify-between border-t border-[#d8e2df] pt-4 text-base font-extrabold text-[#17211f]">
          <span>Total</span>
          <span>{priceFormatter.format(order.totals.grandTotal)}</span>
        </div>
      </div>
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
    <section className="rounded-lg border border-[#d8e2df] bg-white p-5">
      <h2 className="text-lg font-extrabold text-[#17211f]">
        Status timeline
      </h2>
      <div className="mt-5 grid gap-4">
        {entries.map((entry) => (
          <div className="flex gap-3" key={entry.id}>
            <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#dff3ef] text-[#0f6b50]">
              <RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="font-extrabold text-[#17211f]">
                {formatOrderStatus(entry.status)}
              </p>
              <p className="mt-1 text-sm font-bold text-[#687773]">
                {formatDate(entry.createdAt)}
              </p>
              {entry.note ? (
                <p className="mt-1 text-sm leading-6 text-[#687773]">
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

function StatusBadge({
  label,
  tone = "status"
}: {
  label: string;
  tone?: "payment" | "status";
}) {
  return (
    <span
      className={[
        "inline-flex min-h-8 items-center rounded-full px-3 text-xs font-extrabold",
        tone === "payment"
          ? "bg-[#eef3f1] text-[#31413d]"
          : "bg-[#dff3ef] text-[#0f6b50]"
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <strong className="text-right text-[#17211f]">{value}</strong>
    </div>
  );
}

function OrdersListSkeleton() {
  return <TableSkeleton columns={5} rows={4} />;
}

function OrderDetailSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
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

function formatOrderStatus(status: Order["status"]) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPaymentStatus(status: Order["paymentStatus"]) {
  return formatOrderStatus(status as Order["status"]);
}

function formatPaymentMethod(method: Order["paymentMethod"]) {
  if (!method) {
    return "Not selected";
  }

  return method === "COD" ? "Cash on delivery" : "Online";
}
