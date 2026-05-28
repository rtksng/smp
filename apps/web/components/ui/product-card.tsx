"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
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
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
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
    <article className="group grid h-full overflow-hidden rounded-lg border border-[#d8e2df] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#006d77] hover:shadow-xl">
      <div className="relative h-52 bg-[#eef3f1]">
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
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#e7f3f2,#eef3f1)] px-4 text-center text-[#006d77]">
            <PackageCheck aria-hidden="true" className="h-14 w-14" />
            <span className="text-xs font-extrabold text-[#084c61]">
              Product image unavailable
            </span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#084c61] shadow-sm">
          {product.inStock ? "In stock" : "Out of stock"}
        </span>
        {savings ? (
          <span className="absolute right-3 top-3 rounded-full bg-[#0a7f32] px-3 py-1 text-xs font-extrabold text-white shadow-sm">
            {savings.percent}% off
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 p-5">
        <div>
          <p className="text-xs font-extrabold uppercase text-[#9b6a1e]">
            {product.brand.name}
          </p>
          <h3 className="mt-2 line-clamp-2 text-lg font-extrabold leading-6 text-[#17211f]">
            {product.name}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#687773]">
            {product.shortDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold text-[#31413d]">
          <span className="rounded-full bg-[#eef3f1] px-3 py-1">
            SKU {product.sku}
          </span>
          <span className="rounded-full bg-[#eef3f1] px-3 py-1">
            {product.taxRate}% GST
          </span>
          {product.sterile ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f3f2] px-3 py-1 text-[#006d77]">
              <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Sterile
            </span>
          ) : null}
          {product.packSize ? (
            <span className="rounded-full bg-[#f7e9c8] px-3 py-1">
              {product.packSize}
            </span>
          ) : null}
        </div>

        <div className="rounded-lg border border-[#d8e2df] bg-[#f8fbfa] p-4">
          <p className="text-xs font-extrabold uppercase text-[#687773]">
            Hospital price
          </p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#17211f]">
            {formatRupees(product.sellingPrice)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="text-[#687773]">MRP {formatRupees(product.mrp)}</span>
            {savings ? (
              <span className="rounded-full bg-[#e5f6ea] px-2 py-1 text-[#0a7f32]">
                Save {formatRupees(savings.amount)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 text-xs font-bold text-[#31413d] sm:grid-cols-2">
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#eef3f1] px-3 py-2">
            <FileText aria-hidden="true" className="h-4 w-4 text-[#006d77]" />
            GST invoice ready
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#eef3f1] px-3 py-2">
            <Truck aria-hidden="true" className="h-4 w-4 text-[#006d77]" />
            Delivery at checkout
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Button
            aria-label={`Add ${product.name} to cart`}
            className="w-full"
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
          <Button className="w-full sm:w-auto" href={`/products/${product.slug}`} variant="outline">
            <Eye aria-hidden="true" className="h-4 w-4" />
            Details
          </Button>
        </div>

        {!product.inStock ? (
          <p className="rounded-lg bg-[#fff5f5] px-3 py-2 text-xs font-extrabold text-[#7a271a]">
            {stockErrorMessage()}
          </p>
        ) : null}
        {actionMessage ? (
          <p
            className={[
              "rounded-lg px-3 py-2 text-xs font-extrabold",
              actionMessage.tone === "error"
                ? "bg-[#fff5f5] text-[#7a271a]"
                : "bg-[#e7f3f2] text-[#006d77]"
            ].join(" ")}
          >
            {actionMessage.text}
          </p>
        ) : null}
      </div>
    </article>
  );
}
