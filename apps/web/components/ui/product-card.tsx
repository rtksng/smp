"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  ChevronRight,
  FileText,
  PackageCheck,
  ShoppingCart,
  Truck
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  getFriendlyApiErrorMessage,
  stockErrorMessage
} from "../../lib/api/error-messages";
import { createAddCartItemMutation } from "../../lib/api/mutation-helpers";
import { getCurrentCustomerPath } from "../../lib/auth/current-path";
import type { Product } from "../../lib/api/schemas";
import { formatRupees, getProductSavings } from "../../lib/catalog/product-pricing";
import { getProductImageAlt } from "../../lib/seo/metadata";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { useCartStore } from "../../lib/stores/cart-store";
import { Button } from "./button";

type ProductCardProps = {
  compact?: boolean;
  minimal?: boolean;
  product: Product;
  showDescription?: boolean;
  showServiceBadges?: boolean;
};

export function ProductCard({
  compact = false,
  minimal = false,
  product,
  showDescription = true,
  showServiceBadges = true
}: ProductCardProps) {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const promptLogin = useCustomerAuthStore((state) => state.promptLogin);
  const session = useCustomerAuthStore((state) => state.session);
  const setCartSummary = useCartStore((state) => state.setSummary);
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const savings = getProductSavings(product);
  const recommendationCard = compact && minimal;
  const addCartMutation = useMutation(
    createAddCartItemMutation({
      queryClient,
      setCartSummary
    })
  );

  async function handleAddToCart() {
    if (!product.inStock) {
      return;
    }

    if (!session) {
      promptLogin(getCurrentCustomerPath());
      return;
    }

    setActionMessage(null);

    try {
      await addCartMutation.mutateAsync({
        productId: product.id,
        quantity: 1,
        variantId: null
      });
      setActionMessage({ text: "Added to cart.", tone: "success" });
    } catch (error) {
      setActionMessage({
        text: getFriendlyApiErrorMessage(error, "Unable to add item to cart."),
        tone: "error"
      });
    }
  }

  return (
    <article
      className={[
        "group relative grid h-full min-w-0 grid-rows-[auto_1fr] overflow-hidden border border-[#c4e4e0] bg-white shadow-sm shadow-[#0f6f68]/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#0f6f68] hover:shadow-lg hover:shadow-[#0f6f68]/10",
        compact ? "rounded-xl sm:rounded-lg" : "rounded-[1.25rem]",
        compact && !recommendationCard ? "min-h-[14.3rem] sm:min-h-0" : undefined
      ].join(" ")}
    >
      <Link
        aria-label={`Open ${product.name} details`}
        className="absolute inset-0 z-10 rounded-[inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f6f68] focus-visible:ring-inset"
        href={`/products/${product.slug}`}
      />
      <div
        className={[
          "relative border-b border-[#c4e4e0] bg-[#f3faf9]",
          recommendationCard ? "h-28" : compact ? "h-24 sm:h-36" : "h-48"
        ].join(" ")}
      >
        {image && !imageFailed ? (
          <Image
            alt={getProductImageAlt(product.name, image.altText)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            onError={() => setImageFailed(true)}
            sizes={
              compact
                ? "(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 50vw"
                : "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            }
            src={image.url}
            unoptimized
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#e5f5f3,#ffffff)] px-3 text-center text-[#0f6f68]">
            <PackageCheck
              aria-hidden="true"
              className={compact ? "h-9 w-9 sm:h-12 sm:w-12" : "h-14 w-14"}
            />
            <span className="text-xs font-semibold text-[#123f3c]">
              Product image unavailable
            </span>
          </div>
        )}
        <span
          className={[
            "absolute left-3 top-3 rounded-full bg-white font-semibold text-[#0f6f68] shadow-sm",
            compact
              ? "hidden px-2 py-0.5 text-[10px] sm:block"
              : "px-3 py-1 text-xs"
          ].join(" ")}
        >
          {product.inStock ? "In stock" : "Out of stock"}
        </span>
        {savings ? (
          <span
            className={[
              "absolute right-3 top-3 rounded-full bg-[#0f6f68] font-semibold text-white shadow-sm",
              compact
                ? "hidden px-2 py-0.5 text-[10px] sm:block"
                : "px-3 py-1 text-xs"
            ].join(" ")}
          >
            {savings.percent}% off
          </span>
        ) : null}
        {compact && !recommendationCard ? (
          <button
            aria-label={`Add ${product.name} to cart`}
            className="absolute bottom-2 right-2 z-20 rounded-lg border border-[#0f6f68] bg-white px-2 py-0.5 !text-xs !font-medium !leading-4 text-[#0f6f68] shadow-sm sm:hidden disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!product.inStock || addCartMutation.isPending}
            onClick={handleAddToCart}
            type="button"
          >
            {addCartMutation.isPending
              ? "Adding..."
              : product.inStock
                ? "Add"
                : "Out of stock"}
          </button>
        ) : null}
      </div>

      <div
        className={
          recommendationCard
            ? "grid gap-2.5 p-3"
            : compact
              ? "grid gap-1 p-3 sm:content-between sm:gap-3 sm:p-4"
              : "grid gap-4 p-4 sm:p-5"
        }
      >
        <div>
          <div
            className={
              recommendationCard
                ? "flex flex-wrap items-center gap-1.5 text-[11px] font-semibold"
                : compact
                  ? "flex flex-wrap items-center gap-1.5 text-[11px] font-semibold sm:text-xs sm:font-semibold"
                  : "flex flex-wrap items-center gap-2 text-xs font-semibold"
            }
          >
            <span
              className={
                compact && !recommendationCard
                  ? "text-[#55716e] sm:text-[#0f6f68]"
                  : "text-[#0f6f68]"
              }
            >
              {product.brand.name}
            </span>
            {!compact ? (
              <>
                <ChevronRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-[#9ab5b1]"
                />
                <span className="text-[#55716e]">
                  {product.category.name}
                </span>
              </>
            ) : null}
          </div>
          <h3
            className={[
              "line-clamp-2 break-words text-[#123f3c]",
              recommendationCard
                ? "mt-2 text-sm font-semibold leading-5"
                : compact
                  ? "min-h-9 text-xs font-semibold leading-[1.15rem] sm:mt-2 sm:min-h-0 sm:text-base sm:font-semibold sm:leading-5"
                  : "mt-2 text-lg font-semibold leading-6"
            ].join(" ")}
          >
            {product.name}
          </h3>
          {!compact && showDescription ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#55716e]">
              {product.shortDescription}
            </p>
          ) : null}
        </div>

        {!compact ? (
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#123f3c]">
            <span className="rounded-full bg-[#e5f5f3] px-3 py-1">
              SKU {product.sku}
            </span>
            <span className="rounded-full bg-[#e5f5f3] px-3 py-1">
              {product.taxRate}% GST
            </span>
            {product.subcategory ? (
              <span className="rounded-full bg-[#e5f5f3] px-3 py-1 text-[#0f6f68]">
                {product.subcategory.name}
              </span>
            ) : null}
            {product.sterile ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#e5f5f3] px-3 py-1 text-[#0f6f68]">
                <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                Sterile
              </span>
            ) : null}
            {product.packSize ? (
              <span className="rounded-full bg-[#f3faf9] px-3 py-1">
                {product.packSize}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={
            compact
              ? recommendationCard
                ? "border-t border-[#c4e4e0] pt-2.5"
                : "sm:border-t sm:border-[#c4e4e0] sm:pt-4"
              : "rounded-[1rem] border border-[#c4e4e0] bg-[#f3faf9] p-4 shadow-sm shadow-[#0f6f68]/5"
          }
        >
          {!compact ? (
            <p className="text-xs font-semibold uppercase text-[#55716e]">
              Hospital price
            </p>
          ) : null}
          <div
            className={
              compact && !recommendationCard
                ? "grid gap-1 sm:mt-1 sm:flex sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-1"
                : "mt-1 flex flex-wrap items-end gap-x-3 gap-y-1"
            }
          >
            <p
              className={[
                recommendationCard
                  ? "font-semibold tabular-nums text-[#123f3c] text-lg"
                  : compact
                    ? "tabular-nums text-base font-black leading-5 text-[#123432] sm:text-xl sm:font-semibold sm:leading-normal sm:text-[#123f3c]"
                    : "font-semibold tabular-nums text-[#123f3c] text-2xl"
              ].join(" ")}
            >
              {formatRupees(product.sellingPrice)}
            </p>
            <span
              className={[
                compact
                  ? "text-[11px] font-semibold text-[#55716e] sm:pb-1 sm:text-xs sm:font-semibold"
                  : "pb-1 text-xs font-semibold text-[#55716e]"
              ].join(" ")}
            >
              <span
                className={
                  compact
                    ? "line-through text-[11px] font-semibold text-[#55716e] sm:no-underline sm:text-xs sm:font-semibold"
                    : undefined
                }
              >
                MRP {formatRupees(product.mrp)}
              </span>
              {compact && savings ? (
                <span className="ml-1 text-[#0f6f68] sm:hidden">
                  {savings.percent}% OFF
                </span>
              ) : null}
            </span>
          </div>
          {!compact ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
              {savings ? (
                <span className="rounded-full bg-[#e5f5f3] px-2 py-1 text-[#0f6f68]">
                  Save {formatRupees(savings.amount)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {!compact && showServiceBadges ? (
          <div className="grid gap-2 text-xs font-semibold text-[#123f3c] sm:grid-cols-2">
            <span className="inline-flex items-center gap-2 rounded-[1rem] bg-[#e5f5f3] px-3 py-2">
              <FileText aria-hidden="true" className="h-4 w-4 text-[#0f6f68]" />
              GST invoice ready
            </span>
            <span className="inline-flex items-center gap-2 rounded-[1rem] bg-[#e5f5f3] px-3 py-2">
              <Truck aria-hidden="true" className="h-4 w-4 text-[#0f6f68]" />
              Delivery at checkout
            </span>
          </div>
        ) : null}

        <div
          className={
            recommendationCard
              ? "relative z-20 grid gap-2"
              : compact
                ? "relative z-20 hidden gap-2 sm:grid"
                : "relative z-20 grid gap-2"
          }
        >
          <Button
            aria-label={`Add ${product.name} to cart`}
            className={
              recommendationCard
                ? "w-full !min-h-9 !px-3 text-xs"
                : compact
                  ? "w-full !min-h-9 !px-2.5 text-[11px] sm:!min-h-10 sm:text-xs"
                  : "w-full"
            }
            disabled={!product.inStock || addCartMutation.isPending}
            onClick={handleAddToCart}
            variant="outline"
          >
            <ShoppingCart aria-hidden="true" className="h-4 w-4" />
            {addCartMutation.isPending
              ? "Adding..."
              : product.inStock
                ? "Add"
                : "Out of stock"}
          </Button>
        </div>

        {!recommendationCard && !product.inStock ? (
          <p className="rounded-lg bg-[#fff5f5] px-3 py-2 text-xs font-semibold text-[#7a271a]">
            {stockErrorMessage()}
          </p>
        ) : null}
        {!recommendationCard && actionMessage ? (
          <p
            className={[
              "rounded-lg px-3 py-2 text-xs font-semibold",
              actionMessage.tone === "error"
                ? "bg-[#fff5f5] text-[#7a271a]"
                : "bg-[#e5f5f3] text-[#0f6f68]"
            ].join(" ")}
          >
            {actionMessage.text}
          </p>
        ) : null}
      </div>
    </article>
  );
}
