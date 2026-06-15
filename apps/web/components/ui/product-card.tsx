"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  ChevronRight,
  Eye,
  FileText,
  PackageCheck,
  ShoppingCart,
  Truck
} from "lucide-react";
import Image from "next/image";
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
};

export function ProductCard({
  compact = false,
  minimal = false,
  product
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
        "group grid h-full overflow-hidden border border-[#d6e7f8] bg-white shadow-sm shadow-[#0b5cab]/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#0b5cab] hover:shadow-lg hover:shadow-[#0b5cab]/10",
        compact ? "rounded-lg" : "rounded-[1.25rem]"
      ].join(" ")}
    >
      <div
        className={[
          "relative border-b border-[#d6e7f8] bg-[#f4f9ff]",
          recommendationCard ? "h-28" : compact ? "h-36" : "h-48"
        ].join(" ")}
      >
        {image && !imageFailed ? (
          <Image
            alt={getProductImageAlt(product.name, image.altText)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            onError={() => setImageFailed(true)}
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            src={image.url}
            unoptimized
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#edf6ff,#ffffff)] px-4 text-center text-[#0b5cab]">
            <PackageCheck aria-hidden="true" className="h-14 w-14" />
            <span className="text-xs font-bold text-[#12314f]">
              Product image unavailable
            </span>
          </div>
        )}
        <span
          className={[
            "absolute left-3 top-3 rounded-full bg-white font-bold text-[#0b5cab] shadow-sm",
            compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
          ].join(" ")}
        >
          {product.inStock ? "In stock" : "Out of stock"}
        </span>
        {savings ? (
          <span
            className={[
              "absolute right-3 top-3 rounded-full bg-[#0a7f32] font-bold text-white shadow-sm",
              compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
            ].join(" ")}
          >
            {savings.percent}% off
          </span>
        ) : null}
      </div>

      <div
        className={
          recommendationCard ? "grid gap-2.5 p-3" : compact ? "grid gap-3 p-4" : "grid gap-4 p-4 sm:p-5"
        }
      >
        <div>
          <div
            className={
              recommendationCard
                ? "flex flex-wrap items-center gap-1.5 text-[11px] font-bold"
                : "flex flex-wrap items-center gap-2 text-xs font-bold"
            }
          >
            <a
              className="text-[#0b5cab] hover:underline"
              href={`/brands/${product.brand.slug}`}
            >
              {product.brand.name}
            </a>
            {!compact ? (
              <>
                <ChevronRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-[#a9bdd3]"
                />
                <a
                  className="text-[#52677f] hover:underline"
                  href={`/categories/${product.category.slug}`}
                >
                  {product.category.name}
                </a>
              </>
            ) : null}
          </div>
          <h3
            className={[
              "mt-2 line-clamp-2 font-bold text-[#12314f]",
              recommendationCard
                ? "text-sm leading-5"
                : compact
                  ? "text-base leading-5"
                  : "text-lg leading-6"
            ].join(" ")}
          >
            {product.name}
          </h3>
          {!compact ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#52677f]">
              {product.shortDescription}
            </p>
          ) : null}
        </div>

        {!compact ? (
          <div className="flex flex-wrap gap-2 text-xs font-bold text-[#12314f]">
            <span className="rounded-full bg-[#edf6ff] px-3 py-1">
              SKU {product.sku}
            </span>
            <span className="rounded-full bg-[#edf6ff] px-3 py-1">
              {product.taxRate}% GST
            </span>
            {product.subcategory ? (
              <span className="rounded-full bg-[#edf6ff] px-3 py-1 text-[#0b5cab]">
                {product.subcategory.name}
              </span>
            ) : null}
            {product.sterile ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#edf6ff] px-3 py-1 text-[#0b5cab]">
                <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                Sterile
              </span>
            ) : null}
            {product.packSize ? (
              <span className="rounded-full bg-[#f4f9ff] px-3 py-1">
                {product.packSize}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={
            compact
              ? recommendationCard
                ? "border-t border-[#d6e7f8] pt-2.5"
                : "border-t border-[#d6e7f8] pt-4"
              : "rounded-[1rem] border border-[#d6e7f8] bg-[#f4f9ff] p-4 shadow-sm shadow-[#0b5cab]/5"
          }
        >
          {!compact ? (
            <p className="text-xs font-bold uppercase text-[#52677f]">
              Hospital price
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p
              className={[
                "font-bold tabular-nums text-[#12314f]",
                recommendationCard ? "text-lg" : compact ? "text-xl" : "text-2xl"
              ].join(" ")}
            >
              {formatRupees(product.sellingPrice)}
            </p>
            <span className="pb-1 text-xs font-bold text-[#52677f]">
              MRP {formatRupees(product.mrp)}
            </span>
          </div>
          {!compact ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
              {savings ? (
                <span className="rounded-full bg-[#eaf7ee] px-2 py-1 text-[#0a7f32]">
                  Save {formatRupees(savings.amount)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {!compact ? (
          <div className="grid gap-2 text-xs font-bold text-[#12314f] sm:grid-cols-2">
            <span className="inline-flex items-center gap-2 rounded-[1rem] bg-[#edf6ff] px-3 py-2">
              <FileText aria-hidden="true" className="h-4 w-4 text-[#0b5cab]" />
              GST invoice ready
            </span>
            <span className="inline-flex items-center gap-2 rounded-[1rem] bg-[#edf6ff] px-3 py-2">
              <Truck aria-hidden="true" className="h-4 w-4 text-[#0b5cab]" />
              Delivery at checkout
            </span>
          </div>
        ) : null}

        <div
          className={
            recommendationCard ? "grid gap-2" : "grid gap-2 sm:grid-cols-[1fr_auto]"
          }
        >
          {!recommendationCard ? (
            <Button
              aria-label={`Add ${product.name} to cart`}
              className={compact ? "w-full !min-h-10 !px-3 text-xs" : "w-full"}
              disabled={!product.inStock || addCartMutation.isPending}
              onClick={handleAddToCart}
            >
              <ShoppingCart aria-hidden="true" className="h-4 w-4" />
              {addCartMutation.isPending
                ? "Adding..."
                : product.inStock
                  ? "Add to cart"
                  : "Out of stock"}
            </Button>
          ) : null}
          <Button
            className={
              recommendationCard
                ? "w-full !min-h-9 !px-3 text-xs"
                : compact
                  ? "w-full !min-h-10 !px-3 text-xs sm:w-auto"
                  : "w-full sm:w-auto"
            }
            href={`/products/${product.slug}`}
            variant="outline"
          >
            <Eye aria-hidden="true" className="h-4 w-4" />
            {compact ? "View" : "Details"}
          </Button>
        </div>

        {!recommendationCard && !product.inStock ? (
          <p className="rounded-lg bg-[#fff5f5] px-3 py-2 text-xs font-bold text-[#7a271a]">
            {stockErrorMessage()}
          </p>
        ) : null}
        {!recommendationCard && actionMessage ? (
          <p
            className={[
              "rounded-lg px-3 py-2 text-xs font-bold",
              actionMessage.tone === "error"
                ? "bg-[#fff5f5] text-[#7a271a]"
                : "bg-[#edf6ff] text-[#0b5cab]"
            ].join(" ")}
          >
            {actionMessage.text}
          </p>
        ) : null}
      </div>
    </article>
  );
}
