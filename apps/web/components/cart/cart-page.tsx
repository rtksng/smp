"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Layers3,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBag,
  Tag,
  Trash2
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getCart, type Cart, type CartItem } from "../../lib/api/cart";
import {
  getFriendlyApiErrorMessage,
  stockErrorMessage
} from "../../lib/api/error-messages";
import {
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
      <main className="bg-[#f4fbf5]">
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
  const [removeToast, setRemoveToast] = useState<string | null>(null);
  const removeToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const cartQuery = useQuery({
    queryFn: () => getCart(),
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
      onSuccess: () => showRemoveToast(),
      queryClient,
      setCartSummary
    })
  );
  const cart = cartQuery.data;
  const hasBlockingStockIssue =
    cart?.items.some(
      (item) => !item.isAvailable || item.quantity > item.availableQuantity
    ) ?? false;
  const isMutating = updateMutation.isPending || removeMutation.isPending;
  const cartActionError = updateMutation.error ?? removeMutation.error;

  useEffect(() => {
    return () => {
      if (removeToastTimeoutRef.current) {
        clearTimeout(removeToastTimeoutRef.current);
      }
    };
  }, []);

  function showRemoveToast() {
    if (removeToastTimeoutRef.current) {
      clearTimeout(removeToastTimeoutRef.current);
    }

    setRemoveToast("Item removed from cart");
    removeToastTimeoutRef.current = setTimeout(() => {
      setRemoveToast(null);
      removeToastTimeoutRef.current = null;
    }, 2200);
  }

  return (
    <section className="grid gap-6">
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

      {removeToast ? (
        <div
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#bfe7d1] bg-white px-4 py-2 text-sm font-semibold text-[#0a7f32] shadow-lg shadow-[#287c30]/15"
          role="status"
        >
          {removeToast}
        </div>
      ) : null}
    </section>
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
    <article className="relative grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-lg border border-[#cfe9d2] bg-white p-3 shadow-sm shadow-[#287c30]/5 sm:grid-cols-[112px_minmax(0,1fr)] sm:items-start sm:p-4">
      <CartItemImage item={item} priority={priorityImage} />
      <div className="min-w-0 pr-10 sm:pr-12">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#287c30]">
              <a className="hover:underline" href={`/brands/${item.brand.slug}`}>
                {item.brand.name}
              </a>
              <span className="text-[#a3b1ad]">/</span>
              <a
                className="text-[#687773] hover:text-[#287c30] hover:underline"
                href={`/categories/${item.category.slug}`}
              >
                {item.category.name}
              </a>
            </div>
            <a
              className="line-clamp-2 text-base font-semibold leading-6 text-[#17211f] hover:text-[#287c30]"
              href={`/products/${item.slug}`}
            >
              {item.name}
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#687773]">
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#f8fbfa] px-2 py-1">
                <Tag aria-hidden="true" className="h-3.5 w-3.5 text-[#287c30]" />
                SKU {item.sku}
              </span>
              {item.variantName ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#eaf7eb] px-2 py-1 text-[#287c30]">
                  <Layers3 aria-hidden="true" className="h-3.5 w-3.5" />
                  {item.variantName}
                </span>
              ) : null}
              {item.subcategory ? (
                <a
                  className="rounded-lg bg-[#f8fbfa] px-2 py-1 hover:text-[#287c30] hover:underline"
                  href={`/categories/${item.category.slug}?subcategory=${item.subcategory.slug}`}
                >
                  {item.subcategory.name}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {stockWarning ? (
        <div className="col-span-2 flex gap-2 rounded-lg border border-[#f4c7c3] bg-[#fff5f5] p-3 text-sm font-semibold text-[#7a271a]">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>{stockErrorMessage(item.availableQuantity)}</span>
        </div>
      ) : null}

      <div className="col-span-2 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start">
        <QuantityStepper
          disabled={isMutating}
          item={item}
          onDecrease={onDecrease}
          onIncrease={onIncrease}
        />
        <div
          className="grid grid-cols-3 gap-2"
          data-testid="cart-item-pricing-grid"
        >
          <CartMetric label="Price" value={priceFormatter.format(item.unitPrice)} />
          <CartMetric label="GST" value={priceFormatter.format(item.tax)} />
          <CartMetric
            label="Subtotal"
            value={priceFormatter.format(item.subtotal)}
          />
        </div>
      </div>
      <button
        aria-label={`Delete ${item.name} from cart`}
        className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-[#f4c7c3] bg-white/95 text-[#b42318] shadow-md shadow-[#17211f]/10 transition hover:-translate-y-0.5 hover:bg-[#fff5f5] focus:outline-none focus:ring-2 focus:ring-[#b42318] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:right-4 sm:top-4"
        data-cart-delete-button="true"
        disabled={isMutating}
        onClick={onRemove}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </button>
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
    <div
      className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28"
      data-testid="cart-item-image"
    >
      <a
        className="relative block h-full overflow-hidden rounded-lg border border-[#cfe9d2] bg-[#f8fbfa] shadow-sm shadow-[#287c30]/5"
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
          <span className="grid h-full place-items-center text-[#287c30]">
            <PackageCheck aria-hidden="true" className="h-9 w-9" />
          </span>
        )}
      </a>
    </div>
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
      <span className="min-w-10 text-center text-sm font-semibold text-[#17211f]">
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

function CartMetric({
  className,
  label,
  value
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className={[
        "rounded-lg border border-[#cfe9d2] bg-[#f8fbfa] px-3 py-2 shadow-sm shadow-[#287c30]/5",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="block text-[11px] font-semibold uppercase text-[#687773]">
        {label}
      </span>
      <strong className="mt-0.5 block break-words text-sm font-semibold text-[#17211f]">
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
    <aside className="h-fit rounded-lg border border-[#cfe9d2] bg-white p-5 shadow-sm shadow-[#287c30]/5 lg:sticky lg:top-28">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#eaf7eb] text-[#287c30]">
          <ShoppingBag aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-[#17211f]">Price summary</h2>
          <p className="text-sm font-semibold text-[#687773]">
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
        <div className="mt-2 flex items-center justify-between border-t border-[#cfe9d2] pt-4 text-base font-semibold text-[#17211f]">
          <span>Grand total</span>
          <span>{priceFormatter.format(cart.totals.grandTotal)}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {hasBlockingStockIssue ? (
          <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#7a271a]">
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
