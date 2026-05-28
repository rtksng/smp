"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBag,
  Trash2
} from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import {
  getCart,
  type Cart
} from "../../lib/api/cart";
import {
  getFriendlyApiErrorMessage,
  stockErrorMessage
} from "../../lib/api/error-messages";
import {
  createClearCartMutation,
  createRemoveCartItemMutation,
  createUpdateCartItemMutation
} from "../../lib/api/mutation-helpers";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { getProductImageAlt } from "../../lib/seo/metadata";
import { useCartStore } from "../../lib/stores/cart-store";
import { ProtectedCustomerRoute } from "../auth/protected-customer-route";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { EmptyState } from "../ui/empty-state";
import { ErrorState, RetryButton } from "../ui/error-state";
import { SectionLoader } from "../ui/loading-spinner";

const priceFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

export function CartPage() {
  return (
    <>
      <Header />
      <main className="bg-[#f5f8f7]">
        <Container className="py-8">
          <ProtectedCustomerRoute>
            <CartContent />
          </ProtectedCustomerRoute>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function CartContent() {
  const queryClient = useQueryClient();
  const setCartSummary = useCartStore((state) => state.setSummary);
  const cartQuery = useQuery({
    queryFn: getCart,
    queryKey: customerQueryKeys.cart()
  });

  useEffect(() => {
    if (cartQuery.data) {
      setCartSummary(cartQuery.data);
    }
  }, [cartQuery.data, setCartSummary]);

  const updateMutation = useMutation(
    createUpdateCartItemMutation({
      queryClient,
      setCartSummary
    })
  );
  const removeMutation = useMutation(
    createRemoveCartItemMutation({
      queryClient,
      setCartSummary
    })
  );
  const clearMutation = useMutation(
    createClearCartMutation({
      queryClient,
      setCartSummary
    })
  );
  const cart = cartQuery.data;
  const hasBlockingStockIssue =
    cart?.items.some((item) => !item.isAvailable || item.quantity > item.availableQuantity) ??
    false;
  const isMutating =
    updateMutation.isPending || removeMutation.isPending || clearMutation.isPending;
  const cartActionError =
    updateMutation.error ?? removeMutation.error ?? clearMutation.error;

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase text-[#9b6a1e]">
            Customer cart
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-[#17211f]">
            Cart
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687773]">
            Review product availability, quantity, GST, and delivery charges before checkout.
          </p>
        </div>
        {cart && cart.items.length > 0 ? (
          <Button
            className="w-full sm:w-auto"
            disabled={clearMutation.isPending}
            onClick={() => clearMutation.mutate()}
            variant="outline"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {clearMutation.isPending ? "Clearing..." : "Clear cart"}
          </Button>
        ) : null}
      </div>

              {cartQuery.isLoading ? <SectionLoader label="Loading cart" /> : null}

              {cartQuery.isError ? (
                <ErrorState
                  action={<RetryButton onRetry={() => cartQuery.refetch()} />}
                  message={getFriendlyApiErrorMessage(
                    cartQuery.error,
                    "Unable to load cart."
                  )}
                  title="Unable to load cart"
                />
              ) : null}

              {cartActionError ? (
                <ErrorState
                  message={getFriendlyApiErrorMessage(
                    cartActionError,
                    "Unable to update cart."
                  )}
                  title="Unable to update cart"
                />
              ) : null}

              {cart && cart.items.length === 0 ? (
                <EmptyState
                  action={<Button href="/products">Continue shopping</Button>}
                  description="Add surgical and medical equipment from the product catalog to start checkout."
                  title="Your cart is empty"
                />
              ) : null}

              {cart && cart.items.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  <div className="grid gap-4">
                    {cart.items.map((item) => {
                      const stockWarning =
                        !item.isAvailable || item.quantity > item.availableQuantity;

                      return (
                        <article
                          className="grid grid-cols-[88px_1fr] gap-3 rounded-lg border border-[#d8e2df] bg-white p-3 sm:grid-cols-[96px_1fr] sm:gap-4 sm:p-5"
                          key={item.id}
                        >
                          <a
                            className="relative aspect-square overflow-hidden rounded-lg border border-[#d8e2df] bg-[#f8fbfa]"
                            href={`/products/${item.slug}`}
                          >
                            {item.imageUrl ? (
                              <Image
                                alt={getProductImageAlt(item.name, null)}
                                className="object-cover"
                                fill
                                sizes="96px"
                                src={item.imageUrl}
                              />
                            ) : (
                              <span className="grid h-full place-items-center text-[#006d77]">
                                <PackageCheck aria-hidden="true" className="h-10 w-10" />
                              </span>
                            )}
                          </a>
                          <div className="grid gap-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <a
                                  className="line-clamp-2 text-base font-extrabold leading-6 text-[#17211f] hover:text-[#006d77] sm:text-lg"
                                  href={`/products/${item.slug}`}
                                >
                                  {item.name}
                                </a>
                                {item.variantName ? (
                                  <p className="mt-1 text-sm font-bold text-[#687773]">
                                    {item.variantName}
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs font-extrabold uppercase text-[#687773]">
                                  SKU {item.sku}
                                </p>
                              </div>
                              <button
                                aria-label={`Remove ${item.name}`}
                                className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#f4c7c3] bg-[#fff5f5] text-[#b42318]"
                                disabled={isMutating}
                                onClick={() => removeMutation.mutate(item.id)}
                                type="button"
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </div>

                            {stockWarning ? (
                              <div className="flex gap-2 rounded-lg border border-[#f4c7c3] bg-[#fff5f5] p-3 text-sm font-bold text-[#7a271a]">
                                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{stockErrorMessage(item.availableQuantity)}</span>
                              </div>
                            ) : null}

                            <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-end">
                              <div className="inline-flex h-12 w-full max-w-44 items-center justify-between overflow-hidden rounded-lg border border-[#cfdcda] bg-white sm:w-40">
                                <button
                                  aria-label="Decrease quantity"
                                  className="grid h-12 w-12 place-items-center text-[#31413d] disabled:opacity-40"
                                  disabled={item.quantity <= 1 || isMutating}
                                  onClick={() =>
                                    updateMutation.mutate({
                                      itemId: item.id,
                                      quantity: Math.max(1, item.quantity - 1)
                                    })
                                  }
                                  type="button"
                                >
                                  <Minus aria-hidden="true" className="h-4 w-4" />
                                </button>
                                <span className="font-extrabold text-[#17211f]">
                                  {item.quantity}
                                </span>
                                <button
                                  aria-label="Increase quantity"
                                  className="grid h-12 w-12 place-items-center text-[#31413d] disabled:opacity-40"
                                  disabled={isMutating}
                                  onClick={() =>
                                    updateMutation.mutate({
                                      itemId: item.id,
                                      quantity: item.quantity + 1
                                    })
                                  }
                                  type="button"
                                >
                                  <Plus aria-hidden="true" className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid gap-2 text-sm sm:grid-cols-3">
                                <CartMetric label="Price" value={priceFormatter.format(item.unitPrice)} />
                                <CartMetric label="GST" value={priceFormatter.format(item.tax)} />
                                <CartMetric label="Subtotal" value={priceFormatter.format(item.subtotal)} />
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <CartSummary
                    cart={cart}
                    hasBlockingStockIssue={hasBlockingStockIssue}
                    isMutating={isMutating}
                  />
                </div>
              ) : null}
    </section>
  );
}

function CartMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f8fbfa] px-3 py-2">
      <span className="block text-xs font-bold text-[#687773]">{label}</span>
      <strong className="break-words text-[#17211f]">{value}</strong>
    </div>
  );
}

function CartSummary({
  cart,
  hasBlockingStockIssue,
  isMutating
}: {
  cart: Cart;
  hasBlockingStockIssue: boolean;
  isMutating: boolean;
}) {
  return (
    <aside className="h-fit rounded-lg border border-[#d8e2df] bg-white p-5 lg:sticky lg:top-28">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
          <ShoppingBag aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#17211f]">Price summary</h2>
          <p className="text-sm font-bold text-[#687773]">
            {cart.totalQuantity} item{cart.totalQuantity === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm">
        <SummaryRow label="Subtotal" value={cart.totals.subtotal} />
        <SummaryRow
          label="Discount"
          value={cart.totals.discount > 0 ? -cart.totals.discount : 0}
        />
        <SummaryRow label="Delivery charge" value={cart.totals.deliveryCharge} />
        <SummaryRow label="Tax/GST" value={cart.totals.tax} />
        <div className="mt-2 flex items-center justify-between border-t border-[#d8e2df] pt-4 text-base font-extrabold text-[#17211f]">
          <span>Grand total</span>
          <span>{priceFormatter.format(cart.totals.grandTotal)}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {hasBlockingStockIssue ? (
          <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]">
            Resolve stock warnings to continue checkout.
          </p>
        ) : null}
        {hasBlockingStockIssue || isMutating ? (
          <Button className="w-full" disabled>Proceed to checkout</Button>
        ) : (
          <Button className="w-full" href="/checkout">Proceed to checkout</Button>
        )}
        <Button className="w-full" href="/products" variant="outline">
          Continue shopping
        </Button>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-[#31413d]">
      <span>{label}</span>
      <strong>{priceFormatter.format(value)}</strong>
    </div>
  );
}
