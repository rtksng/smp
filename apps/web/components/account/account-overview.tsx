"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPin, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import { customerQueryKeys } from "../../lib/api/query-keys";
import {
  getCustomerProfile,
  listCustomerAddresses,
  type CustomerAddress
} from "../../lib/api/customer-profile";
import { listCustomerOrders, type Order } from "../../lib/api/orders";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { Button } from "../ui/button";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Skeleton } from "../ui/skeleton";
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

export function AccountOverview() {
  const sessionCustomer = useCustomerAuthStore((state) => state.session?.customer);
  const profileQuery = useQuery({
    queryFn: getCustomerProfile,
    queryKey: customerQueryKeys.profile()
  });
  const addressesQuery = useQuery({
    queryFn: listCustomerAddresses,
    queryKey: customerQueryKeys.addresses()
  });
  const ordersQuery = useQuery({
    queryFn: () => listCustomerOrders(1, 3),
    queryKey: customerQueryKeys.orders(1, 3)
  });
  const profile = profileQuery.data;
  const addresses = addressesQuery.data ?? [];
  const recentOrders = ordersQuery.data?.items ?? [];
  const defaultAddress = addresses.find((address) => address.isDefault);
  const profileName =
    profile?.name ?? sessionCustomer?.firstName ?? "Customer";
  const profileEmail =
    profile?.email ?? sessionCustomer?.email ?? "Not added";
  const totalOrders = ordersQuery.data?.pagination.total ?? recentOrders.length;

  return (
    <CustomerAccountShell
      activePath="/account"
      description="Manage your customer details, saved delivery addresses, and medical equipment orders."
      title="Account overview"
    >
      <AccountInfoGrid
        items={[
          {
            label: "Customer",
            value: profileName
          },
          {
            label: "Mobile number",
            value: profile?.mobileNumber ?? sessionCustomer?.mobileNumber ?? "-"
          },
          {
            label: "Saved addresses",
            value: formatCount(addresses.length, "saved address", "saved addresses")
          },
          {
            label: "Orders",
            value: formatCount(totalOrders, "order", "orders")
          }
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <AccountSection>
            <AccountSectionHeader
              action={
                <Button href="/account/profile" variant="outline">
                  Edit profile
                </Button>
              }
              description="Billing details used for checkout, invoices, and order communication."
              title="Profile"
            />
            {profileQuery.isLoading ? <OverviewProfileSkeleton /> : null}
            {profileQuery.isError ? (
              <ErrorState
                action={<RetryButton onRetry={() => profileQuery.refetch()} />}
                className="mt-4"
                message={getFriendlyApiErrorMessage(
                  profileQuery.error,
                  "Unable to load profile."
                )}
                title="Unable to load profile"
              />
            ) : null}
            {profile ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <OverviewDetail
                  icon={<UserRound aria-hidden="true" className="h-4 w-4" />}
                  label="Name"
                  value={profile.name}
                />
                <OverviewDetail label="Email" value={profileEmail} />
                <OverviewDetail
                  label="Business"
                  value={profile.businessName ?? "Not added"}
                />
                <OverviewDetail
                  label="GST number"
                  value={profile.gstNumber ?? "Not added"}
                />
              </div>
            ) : null}
          </AccountSection>

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
              <div className="mt-4 divide-y divide-[#d6e7f8]">
                {recentOrders.map((order) => (
                  <RecentOrderRow key={order.id} order={order} />
                ))}
              </div>
            ) : null}
          </AccountSection>
        </div>

        <AccountSection className="h-fit">
          <AccountSectionHeader
            action={
              <Button href="/account/addresses" variant="outline">
                Manage addresses
              </Button>
            }
            description="Default delivery destination used first at checkout."
            title="Default address"
          />
          {addressesQuery.isLoading ? <DefaultAddressSkeleton /> : null}
          {addressesQuery.isError ? (
            <ErrorState
              action={<RetryButton onRetry={() => addressesQuery.refetch()} />}
              className="mt-4"
              message={getFriendlyApiErrorMessage(
                addressesQuery.error,
                "Unable to load addresses."
              )}
              title="Unable to load addresses"
            />
          ) : null}
          {addressesQuery.isSuccess && !defaultAddress ? (
            <PrivateEmptyState
              action={<Button href="/account/addresses">Add address</Button>}
              description="Add a delivery address to make checkout faster."
              title="No default address"
            />
          ) : null}
          {defaultAddress ? <DefaultAddress address={defaultAddress} /> : null}
        </AccountSection>
      </div>
    </CustomerAccountShell>
  );
}

function OverviewDetail({
  icon,
  label,
  value
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#d6e7f8] bg-[#f4f9ff] p-4 shadow-sm shadow-[#0b5cab]/5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase text-[#52677f]">
        {icon}
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-bold text-[#12314f]">
        {value}
      </p>
    </div>
  );
}

function RecentOrderRow({ order }: { order: Order }) {
  return (
    <a
      className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      href={`/account/orders/${order.id}`}
    >
      <div className="min-w-0">
        <p className="break-words text-sm font-bold text-[#0b5cab]">
          {order.orderNumber}
        </p>
        <p className="mt-1 text-xs font-bold text-[#52677f]">
          Placed {formatDate(order.placedAt ?? order.createdAt)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AccountStatusBadge tone="success">
            {formatOrderStatus(order.status)}
          </AccountStatusBadge>
          <AccountStatusBadge>{formatPaymentStatus(order.paymentStatus)}</AccountStatusBadge>
        </div>
      </div>
      <p className="text-sm font-bold text-[#12314f]">
        {priceFormatter.format(order.totals.grandTotal)}
      </p>
    </a>
  );
}

function DefaultAddress({ address }: { address: CustomerAddress }) {
  return (
    <div className="mt-4 rounded-lg border border-[#d6e7f8] bg-[#f4f9ff] p-4 shadow-sm shadow-[#0b5cab]/5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#edf6ff] text-[#0b5cab]">
          <MapPin aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-sm font-bold text-[#12314f]">
              {address.fullName}
            </p>
            <AccountStatusBadge tone="success">Default</AccountStatusBadge>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#52677f]">
            {address.addressLine1}
            {address.addressLine2 ? `, ${address.addressLine2}` : ""},{" "}
            {address.city}, {address.state} {address.pincode}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#52677f]">
            {address.phone}
          </p>
        </div>
      </div>
    </div>
  );
}

function OverviewProfileSkeleton() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton className="h-20" key={index} />
      ))}
    </div>
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

function DefaultAddressSkeleton() {
  return (
    <div className="mt-4 grid gap-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function formatCount(count: number, singularLabel: string, pluralLabel: string) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
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
