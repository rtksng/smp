"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  Boxes,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Zap
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useMemo, useState } from "react";
import {
  getFriendlyApiErrorMessage,
  isNotFoundApiError,
  stockErrorMessage
} from "../../lib/api/error-messages";
import {
  createAddCartItemMutation,
  createBuyNowCartItemMutation
} from "../../lib/api/mutation-helpers";
import {
  getProduct,
  getRelatedProducts,
  getSimilarProducts
} from "../../lib/api/products";
import type { Product } from "../../lib/api/schemas";
import { getCurrentCustomerPath } from "../../lib/auth/current-path";
import {
  documentTypeLabel,
  getVisibleProductDocuments
} from "../../lib/catalog/product-documents";
import { formatRupees, getProductSavings } from "../../lib/catalog/product-pricing";
import { getProductImageAlt } from "../../lib/seo/metadata";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { useCartStore } from "../../lib/stores/cart-store";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { EmptyState } from "../ui/empty-state";
import { ErrorState, RetryButton } from "../ui/error-state";
import { ProductCard } from "../ui/product-card";
import { SectionHeader } from "../ui/section-header";
import { ProductDetailSkeleton, ProductGridSkeleton } from "./product-skeletons";

type ProductDetailPageProps = {
  initialProduct?: Product;
  slug: string;
};

export function ProductDetailPage({ initialProduct, slug }: ProductDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>();
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const [actionMessage, setActionMessage] = useState<string | undefined>();
  const setCartSummary = useCartStore((state) => state.setSummary);
  const promptLogin = useCustomerAuthStore((state) => state.promptLogin);
  const session = useCustomerAuthStore((state) => state.session);
  const productQuery = useQuery({
    initialData: initialProduct,
    queryFn: () => getProduct(slug),
    queryKey: ["product", slug]
  });
  const product = productQuery.data;
  const relatedProductsQuery = useQuery({
    enabled: Boolean(product?.slug),
    queryFn: () => getRelatedProducts(product?.slug ?? slug, { limit: 4 }),
    queryKey: ["related-products", product?.slug]
  });
  const similarCategoryQuery = useQuery({
    enabled: Boolean(product?.slug),
    queryFn: () => getSimilarProducts(product?.slug ?? slug, { limit: 4 }),
    queryKey: ["similar-products", product?.slug]
  });
  const selectedImage = useMemo(() => {
    if (!product) {
      return undefined;
    }

    return (
      product.images.find((image) => image.id === selectedImageId) ??
      product.images.find((image) => image.isPrimary) ??
      product.images[0]
    );
  }, [product, selectedImageId]);
  const addCartMutation = useMutation(
    createAddCartItemMutation({
      queryClient,
      setCartSummary
    })
  );
  const buyNowMutation = useMutation(
    createBuyNowCartItemMutation({
      queryClient,
      setCartSummary
    })
  );
  const savings = product ? getProductSavings(product) : null;
  const selectedImageFailed = selectedImage
    ? failedImageIds.has(selectedImage.id)
    : false;
  const cartActionPending = addCartMutation.isPending || buyNowMutation.isPending;

  function handleImageError(imageId: string) {
    setFailedImageIds((current) => {
      const next = new Set(current);
      next.add(imageId);
      return next;
    });
  }

  async function handleAddToCart({
    message = "Added to cart.",
    redirectToCheckout = false
  }: {
    message?: string;
    redirectToCheckout?: boolean;
  } = {}) {
    if (!session) {
      promptLogin(getCurrentCustomerPath());
      return;
    }

    if (!product) {
      return;
    }

    setActionMessage(undefined);

    if (!product.inStock) {
      setActionMessage(stockErrorMessage());
      return;
    }

    try {
      const input = {
        productId: product.id,
        quantity,
        variantId: null
      };

      if (redirectToCheckout) {
        await buyNowMutation.mutateAsync(input);
      } else {
        await addCartMutation.mutateAsync(input);
      }

      setActionMessage(message);

      if (redirectToCheckout) {
        router.push("/checkout");
      }
    } catch (error) {
      setActionMessage(
        getFriendlyApiErrorMessage(error, "Unable to add item to cart.")
      );
    }
  }

  return (
    <>
      <Header />
      <main className="bg-[#f4f9ff]">
        <Container className="py-8">
          {productQuery.isLoading ? <ProductDetailSkeleton /> : null}

          {productQuery.isError && isNotFoundApiError(productQuery.error) ? (
            <ErrorState
              action={<Button href="/products">Browse products</Button>}
              message="We could not find that product. It may have been removed or unpublished."
              title="Product not found"
            />
          ) : null}

          {productQuery.isError && !isNotFoundApiError(productQuery.error) ? (
            <ErrorState
              action={<RetryButton onRetry={() => productQuery.refetch()} />}
              message={getFriendlyApiErrorMessage(
                productQuery.error,
                "Unable to load product."
              )}
              title="Unable to load product"
            />
          ) : null}

          {product ? (
            <div className="grid gap-6">
              <nav
                aria-label="Product breadcrumbs"
                className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#687773]"
              >
                <Link className="hover:text-[#006d77]" href="/products">
                  Products
                </Link>
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#a3b1ad]" />
                <Link
                  className="hover:text-[#006d77]"
                  href={`/categories/${product.category.slug}`}
                >
                  {product.category.name}
                </Link>
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#a3b1ad]" />
                <span className="text-[#17211f]">{product.name}</span>
              </nav>

              <div className="grid gap-8 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1fr)_360px]">
                <section className="grid gap-4 xl:self-start">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-[#d6e7f8] bg-white shadow-sm shadow-[#0b5cab]/5">
                    {selectedImage && !selectedImageFailed ? (
                      <Image
                        alt={getProductImageAlt(product.name, selectedImage.altText)}
                        className="object-contain p-6"
                        fill
                        onError={() => handleImageError(selectedImage.id)}
                        priority
                        sizes="(min-width: 1024px) 45vw, 100vw"
                        src={selectedImage.url}
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,#e7f3f2,#eef3f1)] px-4 text-center text-[#006d77]">
                        <PackageCheck aria-hidden="true" className="h-20 w-20" />
                        <span className="text-sm font-bold text-[#084c61]">
                          Product image unavailable
                        </span>
                      </div>
                    )}
                  </div>

                  {product.images.length > 0 ? (
                    <div
                      className="flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0"
                      aria-label="Product image thumbnails"
                    >
                      {product.images.map((image) => (
                        <button
                          aria-current={image.id === selectedImage?.id}
                          className="relative h-20 w-20 shrink-0 snap-start overflow-hidden rounded-lg border border-[#d6e7f8] bg-white shadow-sm shadow-[#0b5cab]/5 data-[active=true]:border-[#006d77] data-[active=true]:ring-2 data-[active=true]:ring-[#006d77]/20 sm:h-auto sm:w-auto sm:aspect-square"
                          data-active={image.id === selectedImage?.id}
                          key={image.id}
                          onClick={() => setSelectedImageId(image.id)}
                          type="button"
                        >
                          {failedImageIds.has(image.id) ? (
                            <div className="flex h-full w-full items-center justify-center bg-[#e7f3f2] text-[#006d77]">
                              <PackageCheck aria-hidden="true" className="h-6 w-6" />
                            </div>
                          ) : (
                            <Image
                              alt={getProductImageAlt(product.name, image.altText)}
                              className="object-contain p-2"
                              fill
                              onError={() => handleImageError(image.id)}
                              sizes="120px"
                              src={image.url}
                              unoptimized
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5 sm:p-6">
                  <p className="text-xs font-bold uppercase text-[#9b6a1e]">
                    {product.brand.name}
                  </p>
                  <h1 className="mt-3 text-xl font-bold leading-snug text-[#17211f] sm:text-3xl">
                    {product.name}
                  </h1>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#31413d]">
                    <span className="rounded-full bg-[#eef3f1] px-3 py-1">
                      SKU {product.sku}
                    </span>
                  <Link
                    className="rounded-full bg-[#e7f3f2] px-3 py-1 text-[#006d77]"
                    href={`/categories/${product.category.slug}`}
                  >
                    {product.category.name}
                  </Link>
                  {product.subcategory ? (
                    <Link
                      className="rounded-full bg-[#e7f3f2] px-3 py-1 text-[#006d77]"
                      href={`/categories/${product.category.slug}?subcategory=${product.subcategory.slug}`}
                    >
                      {product.subcategory.name}
                    </Link>
                  ) : null}
                    <span className="rounded-full bg-[#eef3f1] px-3 py-1">
                      {product.inStock ? "In stock" : "Product out of stock"}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-[#687773]">
                    {product.shortDescription}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <ProductSignal
                      icon={FileText}
                      title="GST invoice"
                      value={`${product.taxRate}% tax rate`}
                    />
                    <ProductSignal
                      icon={Truck}
                      title="Delivery"
                      value="Estimate shown at checkout"
                    />
                    <ProductSignal
                      icon={BadgeCheck}
                      title="Clinical use"
                      value={product.medicalSpecialty ?? "General medical use"}
                    />
                    <ProductSignal
                      icon={ShieldCheck}
                      title="Pack and safety"
                      value={[
                        product.packSize ?? product.unit,
                        product.sterile ? "sterile" : undefined,
                        product.disposable ? "disposable" : undefined
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    />
                  </div>

                  <div className="mt-6 rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0b5cab]/5">
                    <h2 className="text-base font-bold text-[#17211f]">
                      Product summary
                    </h2>
                    <div
                      className="productDescriptionRichText mt-2 text-sm leading-6 text-[#687773]"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  </div>
                </section>

                <aside className="rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5 xl:self-start">
                  <p className="text-xs font-bold uppercase text-[#9b6a1e]">
                    Purchase panel
                  </p>
                  <div className="mt-4 rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0b5cab]/5">
                    <p className="text-xs font-bold text-[#687773]">Hospital price</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-[#17211f]">
                      {formatRupees(product.sellingPrice)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold">
                      <span className="text-[#687773]">
                        MRP {formatRupees(product.mrp)}
                      </span>
                      {savings ? (
                        <span className="rounded-full bg-[#e5f6ea] px-2 py-1 text-xs text-[#0a7f32]">
                          Save {formatRupees(savings.amount)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 text-sm font-bold text-[#31413d]">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#d6e7f8] bg-white px-3 py-2 shadow-sm shadow-[#0b5cab]/5">
                      <span>Quantity</span>
                      <div className="inline-flex h-11 items-center justify-between overflow-hidden rounded-lg border border-[#cfdcda] bg-white">
                        <button
                          aria-label="Decrease quantity"
                          className="grid h-11 w-11 place-items-center text-[#31413d]"
                          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                          type="button"
                        >
                          <Minus aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <span className="min-w-10 text-center font-bold text-[#17211f]">
                          {quantity}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          className="grid h-11 w-11 place-items-center text-[#31413d]"
                          onClick={() => setQuantity((value) => value + 1)}
                          type="button"
                        >
                          <Plus aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-[#d6e7f8] bg-white px-3 py-3 shadow-sm shadow-[#0b5cab]/5">
                      <CreditCard
                        aria-hidden="true"
                        className="h-4 w-4 text-[#006d77]"
                      />
                      COD and online payment at checkout
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-[#d6e7f8] bg-white px-3 py-3 shadow-sm shadow-[#0b5cab]/5">
                      <Building2
                        aria-hidden="true"
                        className="h-4 w-4 text-[#006d77]"
                      />
                      Bulk price support for quantity orders
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <Button
                      className="w-full"
                      disabled={cartActionPending || !product.inStock}
                      onClick={() => handleAddToCart()}
                    >
                      <ShoppingCart aria-hidden="true" className="h-4 w-4" />
                      {addCartMutation.isPending
                        ? "Adding..."
                        : product.inStock
                          ? "Add to cart"
                          : "Out of stock"}
                    </Button>
                    <Button
                      className="w-full"
                      disabled={cartActionPending || !product.inStock}
                      onClick={() =>
                        handleAddToCart({
                          message: "Prepared for checkout.",
                          redirectToCheckout: true
                        })
                      }
                      variant="secondary"
                    >
                      <Zap aria-hidden="true" className="h-4 w-4" />
                      {buyNowMutation.isPending
                        ? "Preparing..."
                        : product.inStock
                          ? "Buy now"
                          : "Unavailable"}
                    </Button>
                  </div>

                  {!product.inStock ? (
                    <p className="mt-4 rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]">
                      {stockErrorMessage()}
                    </p>
                  ) : null}
                  {actionMessage ? (
                    <p className="mt-4 rounded-lg bg-[#e7f3f2] px-4 py-3 text-sm font-bold text-[#006d77]">
                      {actionMessage}
                    </p>
                  ) : null}
                </aside>

                <section className="rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5 xl:col-span-3">
                  <SectionHeader
                    description="Technical details stay structured for clinical review and purchase approval."
                    eyebrow="Product information"
                    size="compact"
                    title="Medical details"
                  />
                  <ProductFacts product={product} />
                </section>

                {product.variants.length > 0 ? (
                  <ProductVariants product={product} />
                ) : null}

                <ProductDocuments product={product} />
              </div>
            </div>
          ) : null}

          {product ? (
            <RelatedSections
              currentProductId={product.id}
              relatedProductsQuery={relatedProductsQuery}
              similarCategoryQuery={similarCategoryQuery}
            />
          ) : null}
        </Container>
      </main>
      <Footer />
    </>
  );
}

function ProductSignal({
  icon: Icon,
  title,
  value
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] p-3 shadow-sm shadow-[#0b5cab]/5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#e7f3f2] text-[#006d77]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <p className="mt-2 text-xs font-bold text-[#17211f]">{title}</p>
      <p className="mt-1 text-xs font-bold leading-4 text-[#687773]">{value}</p>
    </div>
  );
}

function ProductFacts({ product }: { product: Product }) {
  const facts = [
    { label: "Sterile", value: product.sterile ? "Yes" : "No" },
    { label: "Disposable", value: product.disposable ? "Yes" : "No" },
    { label: "Material", value: product.material ?? "Not specified" },
    { label: "Pack size", value: product.packSize ?? "Not specified" },
    { label: "Unit", value: product.unit },
    {
      label: "Medical specialty",
      value: product.medicalSpecialty ?? "General medical use"
    },
    {
      label: "Expiry sensitive",
      value: product.expirySensitive ? "Yes" : "No"
    }
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {facts.map((fact) => (
        <div
          className="flex items-start justify-between gap-4 rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] px-4 py-3 shadow-sm shadow-[#0b5cab]/5"
          key={fact.label}
        >
          <span className="text-sm font-bold text-[#687773]">{fact.label}</span>
          <strong className="min-w-0 break-words text-right text-sm text-[#17211f]">
            {fact.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ProductVariants({ product }: { product: Product }) {
  return (
    <section className="rounded-lg border border-[#d6e7f8] bg-white p-4 shadow-sm shadow-[#0b5cab]/5 xl:col-span-3">
      <SectionHeader
        description="Available pack, size, or SKU options from the product catalog."
        eyebrow="Variants"
        size="compact"
        title="Purchase options"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {product.variants.map((variant) => (
          <article
            className="rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] p-3 shadow-sm shadow-[#0b5cab]/5"
            key={variant.id}
          >
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#e7f3f2] text-[#006d77]">
                <Boxes aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-5 text-[#17211f]">
                  {variant.name}
                </h3>
                <p className="mt-0.5 text-[11px] font-bold uppercase text-[#687773]">
                  SKU {variant.sku}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-base font-bold tabular-nums text-[#17211f]">
                {formatRupees(variant.sellingPrice)}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#31413d]">
                {variant.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-xs font-bold text-[#687773]">
              MRP {formatRupees(variant.mrp)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductDocuments({ product }: { product: Product }) {
  const documents = getVisibleProductDocuments(product.documents);

  return (
    <section className="rounded-lg border border-[#d6e7f8] bg-white p-5 shadow-sm shadow-[#0b5cab]/5 xl:col-span-3">
      <SectionHeader
        description="Customer-visible certificates, manuals, warranty, and compliance files."
        eyebrow="Documents"
        size="compact"
        title="Product documents"
      />
      {documents.length === 0 ? (
        <EmptyState
          description="No certificate, manual, warranty, or compliance document is attached to this product yet."
          title="No documents available"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((document) => (
            <a
              className="flex items-center justify-between gap-4 rounded-lg border border-[#d6e7f8] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0b5cab]/5 transition hover:border-[#006d77]"
              href={document.fileUrl}
              key={document.id}
              rel="noreferrer"
              target="_blank"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
                  <FileText aria-hidden="true" className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block text-[#17211f]">{document.title}</strong>
                  <span className="text-sm font-bold text-[#687773]">
                    {documentTypeLabel(document.type)}
                  </span>
                </span>
              </span>
              <Download
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[#006d77]"
              />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function RelatedSections({
  currentProductId,
  relatedProductsQuery,
  similarCategoryQuery
}: {
  currentProductId: string;
  relatedProductsQuery: ReturnType<
    typeof useQuery<Awaited<ReturnType<typeof getRelatedProducts>>>
  >;
  similarCategoryQuery: ReturnType<
    typeof useQuery<Awaited<ReturnType<typeof getSimilarProducts>>>
  >;
}) {
  const related = relatedProductsQuery.data?.items
    .filter((product) => product.id !== currentProductId)
    .slice(0, 4);
  const similar = similarCategoryQuery.data?.items
    .filter((product) => product.id !== currentProductId)
    .slice(0, 4);

  return (
    <div className="mt-10 grid gap-10">
      <section>
        <SectionHeader
          description="More products from the same brand."
          eyebrow="Related products"
          size="compact"
          title="Related products"
        />
        {relatedProductsQuery.isLoading ? <ProductGridSkeleton /> : null}
        {relatedProductsQuery.isError ? (
          <ErrorState
            action={<RetryButton onRetry={() => relatedProductsQuery.refetch()} />}
            message={getFriendlyApiErrorMessage(
              relatedProductsQuery.error,
              "Unable to load related products."
            )}
          />
        ) : null}
        {related && related.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((product) => (
              <ProductCard compact key={product.id} minimal product={product} />
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeader
          description="Similar products from the same category."
          eyebrow="Similar category"
          size="compact"
          title="Similar category products"
        />
        {similarCategoryQuery.isLoading ? <ProductGridSkeleton /> : null}
        {similarCategoryQuery.isError ? (
          <ErrorState
            action={<RetryButton onRetry={() => similarCategoryQuery.refetch()} />}
            message={getFriendlyApiErrorMessage(
              similarCategoryQuery.error,
              "Unable to load similar products."
            )}
          />
        ) : null}
        {similar && similar.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {similar.map((product) => (
              <ProductCard compact key={product.id} minimal product={product} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
