"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  PackageCheck,
  Truck
} from "lucide-react";
import type { ReactNode } from "react";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import { getOrder } from "../../lib/api/orders";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { ProtectedCustomerRoute } from "../auth/protected-customer-route";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { ErrorState, RetryButton } from "../ui/error-state";
import { SectionLoader } from "../ui/loading-spinner";

const priceFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

export function OrderSuccessPage({ orderId }: { orderId: string }) {
  return (
    <>
      <Header />
      <main className="bg-[#f5f8f7]">
        <Container className="py-8">
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

  return (
    <section className="grid gap-6">
              <div className="rounded-lg border border-[#d8e2df] bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="flex gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
                      <CheckCircle2 aria-hidden="true" className="h-7 w-7" />
                    </span>
                    <div>
                      <p className="text-xs font-extrabold uppercase text-[#9b6a1e]">
                        Order placed
                      </p>
                      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-[#17211f]">
                        Thank you for your order
                      </h1>
                      <p className="mt-2 text-sm font-bold text-[#687773]">
                        Order ID: {orderId}
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
              </div>

              {orderQuery.isLoading ? <SectionLoader label="Loading order" /> : null}

              {orderQuery.isError ? (
                <ErrorState
                  action={<RetryButton onRetry={() => orderQuery.refetch()} />}
                  message={getFriendlyApiErrorMessage(
                    orderQuery.error,
                    "Unable to load order."
                  )}
                  title="Unable to load order"
                />
              ) : null}

              {order ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <section className="rounded-lg border border-[#d8e2df] bg-white p-5">
                    <div className="flex items-center gap-3">
                      <PackageCheck aria-hidden="true" className="h-5 w-5 text-[#006d77]" />
                      <h2 className="text-lg font-extrabold text-[#17211f]">
                        {order.orderNumber}
                      </h2>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {order.items.map((item) => (
                        <div
                          className="flex items-start justify-between gap-4 rounded-lg bg-[#f8fbfa] p-4"
                          key={item.id}
                        >
                          <div>
                            <strong className="block text-[#17211f]">
                              {item.name}
                            </strong>
                            <span className="mt-1 block text-sm font-bold text-[#687773]">
                              SKU {item.sku} x {item.quantity}
                            </span>
                          </div>
                          <strong className="text-right text-[#17211f]">
                            {priceFormatter.format(item.total)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>

                  <aside className="h-fit rounded-lg border border-[#d8e2df] bg-white p-5">
                    <div className="grid gap-4">
                      <StatusTile
                        icon={<Truck aria-hidden="true" className="h-5 w-5" />}
                        label="Order status"
                        value={order.status.replaceAll("_", " ")}
                      />
                      <StatusTile
                        icon={<FileText aria-hidden="true" className="h-5 w-5" />}
                        label="Payment"
                        value={`${order.paymentMethod ?? "-"} / ${order.paymentStatus}`}
                      />
                    </div>
                    {order.shippingAddress ? (
                      <div className="mt-5 rounded-lg bg-[#f8fbfa] p-4">
                        <h3 className="font-extrabold text-[#17211f]">
                          Delivery address
                        </h3>
                        <p className="mt-2 text-sm font-bold leading-6 text-[#687773]">
                          {order.shippingAddress.fullName},{" "}
                          {order.shippingAddress.line1}
                          {order.shippingAddress.line2
                            ? `, ${order.shippingAddress.line2}`
                            : ""}
                          , {order.shippingAddress.city},{" "}
                          {order.shippingAddress.state}{" "}
                          {order.shippingAddress.pincode}
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-5 grid gap-2 text-sm text-[#31413d]">
                      <SummaryRow label="Subtotal" value={order.totals.subtotal} />
                      <SummaryRow
                        label="Discount"
                        value={order.totals.discount > 0 ? -order.totals.discount : 0}
                      />
                      <SummaryRow
                        label="Delivery charge"
                        value={order.totals.deliveryCharge}
                      />
                      <SummaryRow label="Tax/GST" value={order.totals.tax} />
                      <div className="mt-2 flex items-center justify-between border-t border-[#d8e2df] pt-4 text-base font-extrabold text-[#17211f]">
                        <span>Grand total</span>
                        <span>{priceFormatter.format(order.totals.grandTotal)}</span>
                      </div>
                    </div>
                  </aside>
                </div>
              ) : null}
    </section>
  );
}

function StatusTile({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#f8fbfa] p-4">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
        {icon}
      </span>
      <span>
        <span className="block text-xs font-bold text-[#687773]">{label}</span>
        <strong className="text-[#17211f]">{value}</strong>
      </span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <strong>{priceFormatter.format(value)}</strong>
    </div>
  );
}
