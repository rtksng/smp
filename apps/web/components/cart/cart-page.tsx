"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CreditCard,
  FileText,
  Layers3,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getCart, type Cart, type CartItem } from "../../lib/api/cart";
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
      <main className="bg-[#f4f9ff]">
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
    cart?.items.some(
      (item) => !item.isAvailable || item.quantity > item.availableQuantity
    ) ?? false;
  const isMutating =
    updateMutation.isPending || removeMutation.isPending || clearMutation.isPending;
  const cartActionError =
    updateMutation.error ?? removeMutation.error ?? clearMutation.error;

  return (
    <section className="grid gap-6">
      <div className="rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[#9b6a1e]">
              Customer cart
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-[#17211f]">
              Cart
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687773]">
              Review product availability, quantity, GST, and delivery charges before
              checkout.
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
        <CartAssuranceStrip />
      </div>

      {cartQuery.isLoading ? <SectionLoader label="Loading cart" /> : null}

      {cartQuery.isError ? (
        <ErrorState
          action={<RetryButton onRetry={() => cartQuery.refetch()} />}
          message={getFriendlyApiErrorMessage(cartQuery.error, "Unable to load cart.")}
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4">
            {cart.items.map((item, index) => (
              <CartItemCard
                isMutating={isMutating}
                item={item}
                key={item.id}
                onDecrease={() =>
                  updateMutation.mutate({
                    itemId: item.id,
                    quantity: Math.max(1, item.quantity - 1)
                  })
                }
                onIncrease={() =>
                  updateMutation.mutate({
                    itemId: item.id,
                    quantity: item.quantity + 1
                  })
                }
                onRemove={() => removeMutation.mutate(item.id)}
                priorityImage={index === 0}
              />
            ))}
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

function CartAssuranceStrip() {
  const items = [
    { icon: PackageCheck, label: "Stock checked before checkout" },
    { icon: FileText, label: "GST and invoice totals visible" },
    { icon: CreditCard, label: "COD and online payment ready" },
    { icon: ShieldCheck, label: "Authenticated customer flow" }
  ] as const;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div
            className="flex min-h-14 items-center gap-3 rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] px-3 py-2 text-xs font-bold text-[#31413d] shadow-sm shadow-[#0b5cab]/5"
            key={item.label}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#006d77]" />
            {item.label}
          </div>
        );
      })}
    </div>
  );
}

function CartItemCard({
  isMutating,
  item,
  onDecrease,
  onIncrease,
  onRemove,
  priorityImage
}: {
  isMutating: boolean;
  item: CartItem;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
  priorityImage: boolean;
}) {
  const stockWarning =
    !item.isAvailable || item.quantity > item.availableQuantity;

  return (
    <article className="grid gap-4 rounded-lg border border-[#d6e7f8] bg-white p-3 shadow-sm shadow-[#0b5cab]/5 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-start sm:p-4">
      <CartItemImage item={item} priority={priorityImage} />
      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-[#006d77]">
              <a className="hover:underline" href={`/brands/${item.brand.slug}`}>
                {item.brand.name}
              </a>
              <span className="text-[#a3b1ad]">/</span>
              <a
                className="text-[#687773] hover:text-[#006d77] hover:underline"
                href={`/categories/${item.category.slug}`}
              >
                {item.category.name}
              </a>
            </div>
            <a
              className="line-clamp-2 text-base font-bold leading-6 text-[#17211f] hover:text-[#006d77]"
              href={`/products/${item.slug}`}
            >
              {item.name}
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[#687773]">
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#f8fbfa] px-2 py-1">
                <Tag aria-hidden="true" className="h-3.5 w-3.5 text-[#006d77]" />
                SKU {item.sku}
              </span>
              {item.variantName ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#e7f3f2] px-2 py-1 text-[#006d77]">
                  <Layers3 aria-hidden="true" className="h-3.5 w-3.5" />
                  {item.variantName}
                </span>
              ) : null}
              {item.subcategory ? (
                <a
                  className="rounded-lg bg-[#f8fbfa] px-2 py-1 hover:text-[#006d77] hover:underline"
                  href={`/categories/${item.category.slug}?subcategory=${item.subcategory.slug}`}
                >
                  {item.subcategory.name}
                </a>
              ) : null}
            </div>
          </div>
          <button
            aria-label={`Remove ${item.name}`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#f4c7c3] bg-[#fff5f5] px-3 text-xs font-bold text-[#b42318] disabled:opacity-50 sm:min-w-24"
            disabled={isMutating}
            onClick={onRemove}
            type="button"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Remove
          </button>
        </div>

        {stockWarning ? (
          <div className="mt-3 flex gap-2 rounded-lg border border-[#f4c7c3] bg-[#fff5f5] p-3 text-sm font-bold text-[#7a271a]">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>{stockErrorMessage(item.availableQuantity)}</span>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-start">
          <QuantityStepper
            disabled={isMutating}
            item={item}
            onDecrease={onDecrease}
            onIncrease={onIncrease}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <CartMetric label="Price" value={priceFormatter.format(item.unitPrice)} />
            <CartMetric label="GST" value={priceFormatter.format(item.tax)} />
            <CartMetric
              label="Subtotal"
              value={priceFormatter.format(item.subtotal)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function CartItemImage({
  item,
  priority
}: {
  item: CartItem;
  priority: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <a
      className="relative aspect-square overflow-hidden rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] shadow-sm shadow-[#0b5cab]/5 sm:h-28 sm:w-28"
      href={`/products/${item.slug}`}
    >
      {item.imageUrl && !imageFailed ? (
        <Image
          alt={getProductImageAlt(item.name, null)}
          className="object-cover"
          fill
          onError={() => setImageFailed(true)}
          priority={priority}
          sizes="112px"
          src={item.imageUrl}
          unoptimized
        />
      ) : (
        <span className="grid h-full place-items-center text-[#006d77]">
          <PackageCheck aria-hidden="true" className="h-10 w-10" />
        </span>
      )}
    </a>
  );
}

function QuantityStepper({
  disabled,
  item,
  onDecrease,
  onIncrease
}: {
  disabled: boolean;
  item: CartItem;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="inline-flex h-11 w-full max-w-40 items-center justify-between overflow-hidden rounded-lg border border-[#cfdcda] bg-white">
      <button
        aria-label={`Decrease quantity for ${item.name}`}
        className="grid h-11 w-11 place-items-center text-[#31413d] disabled:opacity-40"
        disabled={item.quantity <= 1 || disabled}
        onClick={onDecrease}
        type="button"
      >
        <Minus aria-hidden="true" className="h-4 w-4" />
      </button>
      <span className="min-w-10 text-center text-sm font-bold text-[#17211f]">
        {item.quantity}
      </span>
      <button
        aria-label={`Increase quantity for ${item.name}`}
        className="grid h-11 w-11 place-items-center text-[#31413d] disabled:opacity-40"
        disabled={disabled}
        onClick={onIncrease}
        type="button"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function CartMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] px-3 py-2 shadow-sm shadow-[#0b5cab]/5">
      <span className="block text-[11px] font-bold uppercase text-[#687773]">
        {label}
      </span>
      <strong className="mt-0.5 block break-words text-sm font-bold text-[#17211f]">
        {value}
      </strong>
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
    <aside className="h-fit rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5 lg:sticky lg:top-28">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
          <ShoppingBag aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-[#17211f]">Price summary</h2>
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
        <div className="mt-2 flex items-center justify-between border-t border-[#d6e7f8] pt-4 text-base font-bold text-[#17211f]">
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
          <Button className="w-full" disabled>
            Proceed to checkout
          </Button>
        ) : (
          <Button className="w-full" href="/checkout">
            Proceed to checkout
          </Button>
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
