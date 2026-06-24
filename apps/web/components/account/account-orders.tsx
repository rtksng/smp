"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  CreditCard,
  Download,
  MapPin,
  Truck,
  Undo2,
  XCircle,
  RotateCcw
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getFriendlyApiErrorMessage,
  isNotFoundApiError
} from "../../lib/api/error-messages";
import {
  createCancelOrderMutation,
  createCheckoutPaymentVerificationMutation,
  createCheckoutRazorpayOrderMutation,
  createReorderMutation,
  createRequestReturnMutation
} from "../../lib/api/mutation-helpers";
import { customerQueryKeys } from "../../lib/api/query-keys";
import {
  canDownloadOrderInvoice,
  downloadOrderInvoiceHtml,
  downloadOrderInvoicePdf,
  getOrder,
  listCustomerOrders,
  type Order
} from "../../lib/api/orders";
import { openRazorpayCheckout } from "../../lib/checkout/razorpay";
import { useCartStore } from "../../lib/stores/cart-store";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderQuery = useQuery({
    queryFn: () => getOrder(orderId),
    queryKey: customerQueryKeys.order(orderId)
  });
  const order = orderQuery.data;
  const setCartSummary = useCartStore((state) => state.setSummary);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [isDownloadingPdfInvoice, setIsDownloadingPdfInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const reorderMutation = useMutation(
    createReorderMutation({
      onSuccess: () => router.push("/cart"),
      queryClient,
      setCartSummary
    })
  );
  const cancelOrderMutation = useMutation(
    createCancelOrderMutation({
      onSuccess: () => {
        setActionError(null);
        setActionMessage("Order cancelled successfully.");
      },
      queryClient
    })
  );
  const requestReturnMutation = useMutation(
    createRequestReturnMutation({
      onSuccess: () => {
        setActionError(null);
        setActionMessage("Return request submitted.");
      },
      queryClient
    })
  );
  const createRazorpayOrderMutation = useMutation(
    createCheckoutRazorpayOrderMutation()
  );
  const verifyPaymentMutation = useMutation(
    createCheckoutPaymentVerificationMutation()
  );
  const paymentRetryPending =
    createRazorpayOrderMutation.isPending || verifyPaymentMutation.isPending;

  async function handleDownloadInvoice() {
    if (!order) {
      return;
    }

    try {
      setIsDownloadingInvoice(true);
      setInvoiceError(null);
      await downloadOrderInvoiceHtml(order);
    } catch (error) {
      setInvoiceError(getFriendlyApiErrorMessage(error, "Unable to download invoice."));
    } finally {
      setIsDownloadingInvoice(false);
    }
  }

  async function handleDownloadPdfInvoice() {
    if (!order) {
      return;
    }

    try {
      setIsDownloadingPdfInvoice(true);
      setInvoiceError(null);
      await downloadOrderInvoicePdf(order);
    } catch (error) {
      setInvoiceError(
        getFriendlyApiErrorMessage(error, "Unable to download PDF invoice.")
      );
    } finally {
      setIsDownloadingPdfInvoice(false);
    }
  }

  async function handleRetryOnlinePayment() {
    if (!order) {
      return;
    }

    try {
      setActionError(null);
      setActionMessage(null);
      const razorpayOrder = await createRazorpayOrderMutation.mutateAsync(order.id);
      const paymentResponse = await openRazorpayCheckout({
        amount: razorpayOrder.razorpay.amount,
        contact: order.shippingAddress?.mobileNumber,
        currency: razorpayOrder.razorpay.currency,
        description: order.orderNumber,
        key: razorpayOrder.razorpay.keyId,
        name: "Surgical Medical Equipment",
        orderId: razorpayOrder.razorpay.orderId,
        prefillName: order.shippingAddress?.fullName
      });

      await verifyPaymentMutation.mutateAsync({
        orderId: order.id,
        ...paymentResponse
      });
      await orderQuery.refetch();
      setActionMessage("Payment confirmed successfully.");
    } catch (error) {
      setActionError(
        getFriendlyApiErrorMessage(error, "Unable to retry online payment.")
      );
    }
  }

  async function handleCancelOrder() {
    if (!order) {
      return;
    }

    try {
      setActionError(null);
      setActionMessage(null);
      await cancelOrderMutation.mutateAsync({
        orderId: order.id,
        reason: normalizeOptionalReason(cancelReason)
      });
    } catch (error) {
      setActionError(getFriendlyApiErrorMessage(error, "Unable to cancel order."));
    }
  }

  async function handleRequestReturn() {
    if (!order) {
      return;
    }

    try {
      setActionError(null);
      setActionMessage(null);
      await requestReturnMutation.mutateAsync({
        orderId: order.id,
        reason: normalizeOptionalReason(returnReason)
      });
    } catch (error) {
      setActionError(
        getFriendlyApiErrorMessage(error, "Unable to submit return request.")
      );
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
              <DeliveryTracking order={order} />
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
                    <>
                      <Button
                        disabled={isDownloadingPdfInvoice}
                        onClick={handleDownloadPdfInvoice}
                      >
                        <Download aria-hidden="true" className="h-4 w-4" />
                        {isDownloadingPdfInvoice
                          ? "Downloading PDF..."
                          : "Download PDF invoice"}
                      </Button>
                      <Button
                        disabled={isDownloadingInvoice}
                        onClick={handleDownloadInvoice}
                        variant="outline"
                      >
                        <Download aria-hidden="true" className="h-4 w-4" />
                        {isDownloadingInvoice
                          ? "Downloading HTML..."
                          : "Download HTML invoice"}
                      </Button>
                    </>
                  ) : null}
                  {canRetryOnlinePayment(order) ? (
                    <Button
                      disabled={paymentRetryPending}
                      onClick={handleRetryOnlinePayment}
                      variant="secondary"
                    >
                      <CreditCard aria-hidden="true" className="h-4 w-4" />
                      {paymentRetryPending ? "Opening payment..." : "Retry payment"}
                    </Button>
                  ) : null}
                  {canCancelOrder(order) ? (
                    <div className="grid gap-2 rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-3">
                      <textarea
                        aria-label="Cancellation reason"
                        className="min-h-20 rounded-lg border border-[#b7e2bb] bg-white px-3 py-2 text-sm font-semibold text-[#173b1d] outline-none transition focus:border-[#287c30] focus:ring-2 focus:ring-[#287c30]/15"
                        onChange={(event) => setCancelReason(event.target.value)}
                        placeholder="Cancellation reason"
                        value={cancelReason}
                      />
                      <Button
                        disabled={cancelOrderMutation.isPending}
                        onClick={handleCancelOrder}
                        variant="outline"
                      >
                        <XCircle aria-hidden="true" className="h-4 w-4" />
                        {cancelOrderMutation.isPending
                          ? "Cancelling..."
                          : "Cancel order"}
                      </Button>
                    </div>
                  ) : null}
                  {canRequestReturn(order) ? (
                    <div className="grid gap-2 rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-3">
                      <textarea
                        aria-label="Return request reason"
                        className="min-h-20 rounded-lg border border-[#b7e2bb] bg-white px-3 py-2 text-sm font-semibold text-[#173b1d] outline-none transition focus:border-[#287c30] focus:ring-2 focus:ring-[#287c30]/15"
                        onChange={(event) => setReturnReason(event.target.value)}
                        placeholder="Return request reason"
                        value={returnReason}
                      />
                      <Button
                        disabled={requestReturnMutation.isPending}
                        onClick={handleRequestReturn}
                        variant="outline"
                      >
                        <Undo2 aria-hidden="true" className="h-4 w-4" />
                        {requestReturnMutation.isPending
                          ? "Submitting..."
                          : "Request return"}
                      </Button>
                    </div>
                  ) : null}
                  <Button
                    disabled={reorderMutation.isPending}
                    onClick={() => reorderMutation.mutate(order.id)}
                    variant="outline"
                  >
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    {reorderMutation.isPending ? "Preparing cart..." : "Reorder items"}
                  </Button>
                  <Button href="/account/orders" variant="ghost">
                    Back to orders
                  </Button>
                  {reorderMutation.isError ? (
                    <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#7a271a]">
                      {getFriendlyApiErrorMessage(
                        reorderMutation.error,
                        "Unable to prepare reorder cart."
                      )}
                    </p>
                  ) : null}
                  {actionMessage ? (
                    <p className="rounded-lg bg-[#eaf7eb] px-4 py-3 text-sm font-semibold text-[#287c30]">
                      {actionMessage}
                    </p>
                  ) : null}
                  {actionError ? (
                    <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#7a271a]">
                      {actionError}
                    </p>
                  ) : null}
                  {invoiceError ? (
                    <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#7a271a]">
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
            className="grid gap-3 rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-4 shadow-sm shadow-[#287c30]/5"
            key={order.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  className="break-words text-sm font-semibold text-[#287c30] hover:text-[#23702a]"
                  href={`/account/orders/${order.id}`}
                >
                  {order.orderNumber}
                </Link>
                <p className="mt-1 text-xs font-semibold text-[#556b57]">
                  {formatDate(order.placedAt ?? order.createdAt)}
                </p>
              </div>
              <strong className="shrink-0 text-right text-sm text-[#173b1d]">
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

      <div className="mt-4 hidden overflow-x-auto rounded-lg border border-[#cfe9d2] shadow-sm shadow-[#287c30]/5 md:block">
        <table className="w-full min-w-[760px] border-collapse bg-white text-left">
          <thead className="bg-[#f4fbf5] text-xs uppercase text-[#556b57]">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Payment</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#cfe9d2]">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-4">
                  <Link
                    className="font-semibold text-[#287c30] hover:text-[#23702a]"
                    href={`/account/orders/${order.id}`}
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-[#556b57]">
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
                <td className="px-4 py-4 text-right text-sm font-semibold text-[#173b1d]">
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

      <div className="mt-4 divide-y divide-[#cfe9d2]">
        {order.items.map((item) => (
          <div
            className="grid gap-2 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto]"
            key={item.id}
          >
            <div>
              <p className="text-sm font-semibold text-[#173b1d]">{item.name}</p>
              <p className="mt-1 text-xs font-semibold text-[#556b57]">
                SKU {item.sku} | Qty {item.quantity} | GST {item.taxRate}%
              </p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs font-semibold text-[#556b57]">
                {priceFormatter.format(item.unitPrice)} each
              </p>
              <p className="mt-1 text-base font-semibold text-[#173b1d]">
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
        <div className="mt-4 rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-4 shadow-sm shadow-[#287c30]/5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf7eb] text-[#287c30]">
              <MapPin aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#173b1d]">{address.fullName}</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#556b57]">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.city},{" "}
                {address.state} {address.pincode}, {address.country}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#556b57]">
                {address.mobileNumber}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-[#fff5f5] p-4 text-sm font-semibold text-[#7a271a]">
          Delivery address is not available for this order.
        </p>
      )}
    </AccountSection>
  );
}

function DeliveryTracking({ order }: { order: Order }) {
  if (order.deliveryTracking.length === 0) {
    return null;
  }

  return (
    <AccountSection>
      <AccountSectionHeader
        description="Delivery partner and movement updates for this order."
        title="Delivery tracking"
      />
      <div className="mt-4 grid gap-3">
        {order.deliveryTracking.map((tracking) => (
          <div
            className="rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-4 shadow-sm shadow-[#287c30]/5"
            key={tracking.id}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf7eb] text-[#287c30]">
                <Truck aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#173b1d]">
                  {formatDeliveryStatus(tracking.status)}
                </p>
                {tracking.deliveryPartnerName ? (
                  <p className="mt-1 text-sm font-semibold text-[#556b57]">
                    {tracking.deliveryPartnerName}
                    {tracking.vehicleNumber ? ` | ${tracking.vehicleNumber}` : ""}
                  </p>
                ) : null}
                {tracking.failureReason ? (
                  <p className="mt-1 text-sm font-semibold text-[#7a271a]">
                    {tracking.failureReason}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-[#cfe9d2] pt-4">
              {tracking.statusHistory.map((entry) => (
                <div className="flex gap-3" key={entry.id}>
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#287c30]" />
                  <div>
                    <p className="text-xs font-semibold text-[#173b1d]">
                      {formatDeliveryStatus(entry.status)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#556b57]">
                      {formatDate(entry.createdAt)}
                      {entry.latitude !== null && entry.longitude !== null
                        ? ` | ${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)}`
                        : ""}
                    </p>
                    {entry.note ? (
                      <p className="mt-1 text-sm leading-6 text-[#556b57]">
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AccountSection>
  );
}

function PaymentDetails({ order }: { order: Order }) {
  const latestRefund = order.refunds[0];

  return (
    <AccountSection>
      <AccountSectionHeader
        description="Method, payment state, and final payable total."
        title="Payment details"
      />
      <dl className="mt-4 grid gap-2 text-sm text-[#173b1d]">
        <InfoRow label="Method" value={formatPaymentMethod(order.paymentMethod)} />
        <InfoRow
          label="Payment status"
          value={formatPaymentStatus(order.paymentStatus)}
        />
        {latestRefund ? <RefundDetails refund={latestRefund} /> : null}
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
        <div className="mt-2 flex items-center justify-between border-t border-[#cfe9d2] pt-4 text-base font-semibold text-[#173b1d]">
          <dt>Total</dt>
          <dd>{priceFormatter.format(order.totals.grandTotal)}</dd>
        </div>
      </dl>
    </AccountSection>
  );
}

function RefundDetails({ refund }: { refund: Order["refunds"][number] }) {
  return (
    <div className="my-2 grid gap-2 rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-3">
      <InfoRow label="Return/refund" value={formatRefundStatus(refund.status)} />
      <InfoRow label="Refund amount" value={priceFormatter.format(refund.amount)} />
      <InfoRow label="Requested" value={formatDate(refund.createdAt)} />
      {refund.processedAt ? (
        <InfoRow label="Processed" value={formatDate(refund.processedAt)} />
      ) : null}
      {refund.providerRefundId ? (
        <InfoRow label="Provider reference" value={refund.providerRefundId} />
      ) : null}
      {refund.reason ? (
        <div className="grid gap-1 border-t border-[#cfe9d2] pt-2">
          <dt className="text-[#556b57]">Reason</dt>
          <dd className="font-semibold leading-6 text-[#173b1d]">{refund.reason}</dd>
        </div>
      ) : null}
    </div>
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
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eaf7eb] text-[#287c30]">
              <ClipboardCheck aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#173b1d]">
                {formatOrderStatus(entry.status)}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#556b57]">
                {formatDate(entry.createdAt)}
              </p>
              {entry.note ? (
                <p className="mt-1 text-sm leading-6 text-[#556b57]">{entry.note}</p>
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

function canCancelOrder(order: Order) {
  return ["ASSIGNED", "CONFIRMED", "CREATED", "PACKED"].includes(order.status);
}

function canRequestReturn(order: Order) {
  return (
    order.status === "DELIVERED" &&
    !order.refunds.some((refund) => ["PENDING", "PROCESSING"].includes(refund.status))
  );
}

function canRetryOnlinePayment(order: Order) {
  return (
    order.paymentMethod === "ONLINE" &&
    ["FAILED", "PENDING"].includes(order.paymentStatus) &&
    order.status === "CREATED"
  );
}

function normalizeOptionalReason(value: string) {
  const reason = value.trim();

  return reason.length > 0 ? reason : undefined;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#556b57]">{label}</dt>
      <dd className="text-right font-semibold text-[#173b1d]">{value}</dd>
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

function formatRefundStatus(status: Order["refunds"][number]["status"]) {
  if (status === "CANCELLED") {
    return "Return rejected";
  }

  if (status === "COMPLETED") {
    return "Refund completed";
  }

  if (status === "FAILED") {
    return "Refund failed";
  }

  if (status === "PENDING") {
    return "Return requested";
  }

  if (status === "PROCESSING") {
    return "Refund processing";
  }

  return formatConstantLabel(status);
}

function formatDeliveryStatus(status: Order["deliveryTracking"][number]["status"]) {
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
