"use client";

import { useQuery } from "@tanstack/react-query";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { listCustomerOrders, type Order } from "../../lib/api/orders";
import { Button } from "../ui/button";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Skeleton } from "../ui/skeleton";
import {
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

export function AccountOverview() {
  const ordersQuery = useQuery({
    queryFn: () => listCustomerOrders(1, 3),
    queryKey: customerQueryKeys.orders(1, 3)
  });
  const recentOrders = ordersQuery.data?.items ?? [];

  return (
    <CustomerAccountShell
      activePath="/account"
      description="Review recent orders and use the account navigation to manage profile, wishlist, addresses, quotes, and order history."
      title="Account overview"
    >
      <AccountSection>
        <AccountSectionHeader
          action={
            <Button href="/account/orders" variant="outline">
              View all orders
            </Button>
          }
          description="Latest account orders with their current status and total."
          title="Recent orders"
        />
        {ordersQuery.isLoading ? <RecentOrdersSkeleton /> : null}
        {ordersQuery.isError ? (
          <ErrorState
            action={<RetryButton onRetry={() => ordersQuery.refetch()} />}
            className="mt-4"
            message={getFriendlyApiErrorMessage(
              ordersQuery.error,
              "Unable to load orders."
            )}
            title="Unable to load orders"
          />
        ) : null}
        {ordersQuery.isSuccess && recentOrders.length === 0 ? (
          <PrivateEmptyState
            action={<Button href="/products">Browse products</Button>}
            description="Your recent orders will appear here after checkout."
            title="No orders yet"
          />
        ) : null}
        {recentOrders.length > 0 ? (
          <div className="mt-4 divide-y divide-[#cfe9d2]">
            {recentOrders.map((order) => (
              <RecentOrderRow key={order.id} order={order} />
            ))}
          </div>
        ) : null}
      </AccountSection>
    </CustomerAccountShell>
  );
}

function RecentOrderRow({ order }: { order: Order }) {
  return (
    <a
      className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      href={`/account/orders/${order.id}`}
    >
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-[#287c30]">
          {order.orderNumber}
        </p>
        <p className="mt-1 text-xs font-semibold text-[#556b57]">
          Placed {formatDate(order.placedAt ?? order.createdAt)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AccountStatusBadge tone="success">
            {formatOrderStatus(order.status)}
          </AccountStatusBadge>
          <AccountStatusBadge>
            {formatPaymentStatus(order.paymentStatus)}
          </AccountStatusBadge>
        </div>
      </div>
      <p className="text-sm font-semibold text-[#173b1d]">
        {priceFormatter.format(order.totals.grandTotal)}
      </p>
    </a>
  );
}

function RecentOrdersSkeleton() {
  return (
    <div className="mt-4 grid gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton className="h-16" key={index} />
      ))}
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
  return formatConstantLabel(status);
}

function formatPaymentStatus(status: Order["paymentStatus"]) {
  if (status === "PENDING") {
    return "Payment pending";
  }

  return formatConstantLabel(status);
}

function formatConstantLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
