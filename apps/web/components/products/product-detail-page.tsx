"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Boxes,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Heart,
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
import { useEffect, useMemo, useRef, useState } from "react";
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
  createProductQuestion,
  createProductReview,
  getProductFeedback,
  type ProductFeedback
} from "../../lib/api/product-feedback";
import {
  getProduct,
  getRelatedProducts,
  getSimilarProducts
} from "../../lib/api/products";
import {
  addWishlistItem,
  getWishlist,
  removeWishlistItem
} from "../../lib/api/wishlist";
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
  const [wishlistToast, setWishlistToast] = useState<string | undefined>();
  const [feedbackMessage, setFeedbackMessage] = useState<string | undefined>();
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | undefined>();
  const [reviewRating, setReviewRating] = useState(5);
  const [question, setQuestion] = useState("");
  const [questionError, setQuestionError] = useState<string | undefined>();
  const wishlistToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
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
    queryFn: () => getRelatedProducts(product?.slug ?? slug, { limit: 5 }),
    queryKey: ["related-products", product?.slug]
  });
  const similarCategoryQuery = useQuery({
    enabled: Boolean(product?.slug),
    queryFn: () => getSimilarProducts(product?.slug ?? slug, { limit: 5 }),
    queryKey: ["similar-products", product?.slug]
  });
  const feedbackQuery = useQuery({
    enabled: Boolean(product?.slug),
    queryFn: () => getProductFeedback(product?.slug ?? slug),
    queryKey: ["product-feedback", product?.slug]
  });
  const wishlistQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getWishlist,
    queryKey: ["customer-wishlist"]
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
  const addWishlistMutation = useMutation({
    mutationFn: addWishlistItem,
    onSuccess: (wishlist) => {
      queryClient.setQueryData(["customer-wishlist"], wishlist);
    }
  });
  const removeWishlistMutation = useMutation({
    mutationFn: removeWishlistItem,
    onSuccess: (wishlist) => {
      queryClient.setQueryData(["customer-wishlist"], wishlist);
    }
  });
  const reviewMutation = useMutation({
    mutationFn: (input: { comment: string; rating: number }) =>
      createProductReview(product?.slug ?? slug, input),
    onSuccess: (feedback) => {
      queryClient.setQueryData(["product-feedback", product?.slug], feedback);
      setReviewComment("");
      setReviewError(undefined);
      setReviewRating(5);
      setFeedbackMessage("Review submitted for moderation.");
    }
  });
  const questionMutation = useMutation({
    mutationFn: (input: { question: string }) =>
      createProductQuestion(product?.slug ?? slug, input),
    onSuccess: (feedback) => {
      queryClient.setQueryData(["product-feedback", product?.slug], feedback);
      setQuestion("");
      setQuestionError(undefined);
      setFeedbackMessage("Question submitted for an answer.");
    }
  });
  const savings = product ? getProductSavings(product) : null;
  const selectedImageFailed = selectedImage
    ? failedImageIds.has(selectedImage.id)
    : false;
  const cartActionPending = addCartMutation.isPending || buyNowMutation.isPending;
  const isSaved = Boolean(
    product && wishlistQuery.data?.items.some((item) => item.id === product.id)
  );
  const wishlistPending =
    addWishlistMutation.isPending || removeWishlistMutation.isPending;

  useEffect(() => {
    return () => {
      if (wishlistToastTimeoutRef.current) {
        clearTimeout(wishlistToastTimeoutRef.current);
      }
    };
  }, []);

  function showWishlistToast(message: string) {
    if (wishlistToastTimeoutRef.current) {
      clearTimeout(wishlistToastTimeoutRef.current);
    }

    setWishlistToast(message);
    wishlistToastTimeoutRef.current = setTimeout(() => {
      setWishlistToast(undefined);
      wishlistToastTimeoutRef.current = null;
    }, 1600);
  }

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

  async function handleWishlistToggle() {
    if (!session) {
      promptLogin(getCurrentCustomerPath());
      return;
    }

    if (!product) {
      return;
    }

    try {
      setActionMessage(undefined);

      if (isSaved) {
        await removeWishlistMutation.mutateAsync(product.id);
        setActionMessage("Removed from wishlist.");
      } else {
        await addWishlistMutation.mutateAsync({ productId: product.id });
        showWishlistToast("Added to wishlist");
      }
    } catch (error) {
      setActionMessage(
        getFriendlyApiErrorMessage(error, "Unable to update wishlist.")
      );
    }
  }

  async function handleReviewSubmit() {
    if (!session) {
      promptLogin(getCurrentCustomerPath());
      return;
    }

    const comment = reviewComment.trim();

    setFeedbackMessage(undefined);
    if (comment.length < 5) {
      setReviewError("Enter at least 5 characters for your review.");
      return;
    }
    if (comment.length > 1200) {
      setReviewError("Keep your review to 1,200 characters or fewer.");
      return;
    }

    setReviewError(undefined);
    try {
      await reviewMutation.mutateAsync({
        comment,
        rating: reviewRating
      });
    } catch (error) {
      setReviewError(
        getFriendlyApiErrorMessage(error, "Unable to submit review.")
      );
    }
  }

  async function handleQuestionSubmit() {
    if (!session) {
      promptLogin(getCurrentCustomerPath());
      return;
    }

    const trimmedQuestion = question.trim();

    setFeedbackMessage(undefined);
    if (trimmedQuestion.length < 5) {
      setQuestionError("Enter at least 5 characters for your question.");
      return;
    }
    if (trimmedQuestion.length > 800) {
      setQuestionError("Keep your question to 800 characters or fewer.");
      return;
    }

    setQuestionError(undefined);
    try {
      await questionMutation.mutateAsync({ question: trimmedQuestion });
    } catch (error) {
      setQuestionError(
        getFriendlyApiErrorMessage(error, "Unable to submit question.")
      );
    }
  }

  return (
    <>
      <Header />
      <main
        className="productDetailNoShadows bg-[#f3faf9]"
        data-testid="product-detail-main"
      >
        <Container className="py-4 sm:py-8">
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
            <div className="grid gap-5 sm:gap-6">
              <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                <button
                  aria-label="Back"
                  className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#c4e4e0] bg-white px-3 text-xs font-semibold text-[#0f6f68] shadow-sm shadow-[#0f6f68]/5 transition hover:border-[#0f6f68] hover:bg-[#f3faf9] focus:outline-none focus:ring-2 focus:ring-[#0f6f68] focus:ring-offset-2 sm:min-h-9 sm:text-sm"
                  onClick={() => router.back()}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <nav
                  aria-label="Product breadcrumbs"
                  className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-[#607a77] sm:gap-2 sm:text-sm"
                >
                  <Link className="hover:text-[#0f6f68]" href="/products">
                    Products
                  </Link>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 text-[#9cafac]"
                  />
                  <Link
                    className="hover:text-[#0f6f68]"
                    href={`/categories/${product.category.slug}`}
                  >
                    {product.category.name}
                  </Link>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 text-[#9cafac]"
                  />
                  <span className="text-[#123432]">{product.name}</span>
                </nav>
              </div>

              <div className="grid gap-5 sm:gap-8 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1fr)_360px]">
                <section className="grid gap-3 sm:gap-4 xl:self-start">
                  <div
                    className="relative aspect-square overflow-hidden rounded-lg border border-[#c4e4e0] bg-white shadow-sm shadow-[#0f6f68]/5"
                    data-testid="product-main-image-panel"
                  >
                    {selectedImage && !selectedImageFailed ? (
                      <Image
                        alt={getProductImageAlt(product.name, selectedImage.altText)}
                        className="object-contain p-4 sm:p-6"
                        fill
                        onError={() => handleImageError(selectedImage.id)}
                        priority
                        sizes="(min-width: 1024px) 45vw, 100vw"
                        src={selectedImage.url}
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,#e5f5f3,#eef3f1)] px-4 text-center text-[#0f6f68]">
                        <PackageCheck aria-hidden="true" className="h-20 w-20" />
                        <span className="text-sm font-semibold text-[#0b5e59]">
                          Product image unavailable
                        </span>
                      </div>
                    )}
                    <button
                      aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
                      aria-pressed={isSaved}
                      className={[
                        "absolute bottom-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full border bg-white/95 shadow-lg shadow-[#0f6f68]/15 transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#0f6f68] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
                        isSaved
                          ? "border-[#ffd4d0] text-[#d92d20]"
                          : "border-[#c4e4e0] text-[#123f3c]"
                      ].join(" ")}
                      disabled={wishlistPending}
                      onClick={handleWishlistToggle}
                      type="button"
                    >
                      <Heart
                        aria-hidden="true"
                        className={[
                          "h-5 w-5",
                          isSaved ? "fill-current" : "fill-transparent"
                        ].join(" ")}
                      />
                    </button>
                  </div>

                  {product.images.length > 0 ? (
                    <div
                      className="flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0"
                      aria-label="Product image thumbnails"
                    >
                      {product.images.map((image) => (
                        <button
                          aria-current={image.id === selectedImage?.id}
                          className="relative h-20 w-20 shrink-0 snap-start overflow-hidden rounded-lg border border-[#c4e4e0] bg-white shadow-sm shadow-[#0f6f68]/5 data-[active=true]:border-[#0f6f68] data-[active=true]:ring-2 data-[active=true]:ring-[#0f6f68]/20 sm:h-auto sm:w-auto sm:aspect-square"
                          data-active={image.id === selectedImage?.id}
                          key={image.id}
                          onClick={() => setSelectedImageId(image.id)}
                          type="button"
                        >
                          {failedImageIds.has(image.id) ? (
                            <div className="flex h-full w-full items-center justify-center bg-[#e5f5f3] text-[#0f6f68]">
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

                <section className="rounded-lg border border-[#c4e4e0] bg-white p-4 shadow-sm shadow-[#0f6f68]/5 sm:p-6">
                  <p className="text-xs font-semibold uppercase text-[#0f6f68]">
                    {product.brand.name}
                  </p>
                  <h1 className="mt-2 text-lg font-semibold leading-snug text-[#123432] sm:text-3xl">
                    {product.name}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#2b4946] sm:gap-2 sm:text-xs">
                    <span className="rounded-full bg-[#eef3f1] px-3 py-1">
                      SKU {product.sku}
                    </span>
                  <Link
                    className="rounded-full bg-[#e5f5f3] px-3 py-1 text-[#0f6f68]"
                    href={`/categories/${product.category.slug}`}
                  >
                    {product.category.name}
                  </Link>
                  {product.subcategory ? (
                    <Link
                      className="rounded-full bg-[#e5f5f3] px-3 py-1 text-[#0f6f68]"
                      href={`/categories/${product.category.slug}?subcategory=${product.subcategory.slug}`}
                    >
                      {product.subcategory.name}
                    </Link>
                  ) : null}
                    <span className="rounded-full bg-[#eef3f1] px-3 py-1">
                      {product.inStock ? "In stock" : "Product out of stock"}
                    </span>
                  </div>

                  <p className="mt-3 text-[13px] leading-5 text-[#607a77] sm:text-sm sm:leading-6">
                    {product.shortDescription}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
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
                        .join(" / ") || "Not specified"}
                    />
                  </div>

                  <ProductSummary description={product.description} />
                </section>

                <aside className="rounded-lg border border-[#c4e4e0] bg-white p-4 shadow-sm shadow-[#0f6f68]/5 sm:p-5 xl:self-start">
                  <p className="text-xs font-semibold uppercase text-[#0f6f68]">
                    Purchase panel
                  </p>
                  <div className="mt-4 rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0f6f68]/5">
                    <p className="text-xs font-semibold text-[#607a77]">Hospital price</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-[#123432] sm:text-2xl">
                      {formatRupees(product.sellingPrice)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="text-[#607a77]">
                        MRP {formatRupees(product.mrp)}
                      </span>
                      {savings ? (
                        <span className="rounded-full bg-[#e2f5f2] px-2 py-1 text-xs text-[#0f6f68]">
                          Save {formatRupees(savings.amount)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 text-sm font-semibold text-[#2b4946]">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#c4e4e0] bg-white px-3 py-2 shadow-sm shadow-[#0f6f68]/5">
                      <span>Quantity</span>
                      <div className="inline-flex h-11 items-center justify-between overflow-hidden rounded-lg border border-[#cbdedb] bg-white">
                        <button
                          aria-label="Decrease quantity"
                          className="grid h-11 w-11 place-items-center text-[#2b4946]"
                          onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                          type="button"
                        >
                          <Minus aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <span className="min-w-10 text-center font-semibold text-[#123432]">
                          {quantity}
                        </span>
                        <button
                          aria-label="Increase quantity"
                          className="grid h-11 w-11 place-items-center text-[#2b4946]"
                          onClick={() => setQuantity((value) => value + 1)}
                          type="button"
                        >
                          <Plus aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-[#c4e4e0] bg-white px-3 py-3 shadow-sm shadow-[#0f6f68]/5">
                      <CreditCard
                        aria-hidden="true"
                        className="h-4 w-4 text-[#0f6f68]"
                      />
                      COD and online payment at checkout
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border border-[#c4e4e0] bg-white px-3 py-3 shadow-sm shadow-[#0f6f68]/5">
                      <Building2
                        aria-hidden="true"
                        className="h-4 w-4 text-[#0f6f68]"
                      />
                      Bulk price support for quantity orders
                    </div>
                  </div>

                  <div
                    className="mt-5 hidden gap-3 md:grid"
                    data-testid="desktop-purchase-actions"
                  >
                    <Button
                      className="w-full"
                      disabled={cartActionPending || !product.inStock}
                      onClick={() => handleAddToCart()}
                      variant="outline"
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
                    <p className="mt-4 rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#7a271a]">
                      {stockErrorMessage()}
                    </p>
                  ) : null}
                  {actionMessage ? (
                    <p className="mt-4 rounded-lg bg-[#e5f5f3] px-4 py-3 text-sm font-semibold text-[#0f6f68]">
                      {actionMessage}
                    </p>
                  ) : null}
                </aside>

                <section className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5 xl:col-span-3">
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
                <ProductFeedbackSection
                  feedback={feedbackQuery.data}
                  feedbackMessage={feedbackMessage}
                  question={question}
                  questionError={questionError}
                  questionPending={questionMutation.isPending}
                  reviewComment={reviewComment}
                  reviewError={reviewError}
                  reviewPending={reviewMutation.isPending}
                  reviewRating={reviewRating}
                  setQuestion={(value) => {
                    setQuestion(value);
                    setQuestionError(undefined);
                  }}
                  setReviewComment={(value) => {
                    setReviewComment(value);
                    setReviewError(undefined);
                  }}
                  setReviewRating={setReviewRating}
                  onQuestionSubmit={handleQuestionSubmit}
                  onReviewSubmit={handleReviewSubmit}
                />
              </div>

              <div
                aria-label="Product purchase actions"
                className="fixed inset-x-0 bottom-0 z-40 border-t border-[#c4e4e0] bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-10px_24px_rgba(15,111,104,0.14)] backdrop-blur md:hidden"
                data-testid="mobile-sticky-product-actions"
              >
                <div className="mx-auto grid max-w-screen-sm grid-cols-2 gap-3">
                  <Button
                    className="w-full px-3 text-sm"
                    disabled={cartActionPending || !product.inStock}
                    onClick={() => handleAddToCart()}
                    variant="outline"
                  >
                    <ShoppingCart aria-hidden="true" className="h-4 w-4" />
                    {addCartMutation.isPending
                      ? "Adding..."
                      : product.inStock
                        ? "Add to cart"
                        : "Out of stock"}
                  </Button>
                  <Button
                    className="w-full px-3 text-sm"
                    disabled={cartActionPending || !product.inStock}
                    onClick={() =>
                      handleAddToCart({
                        message: "Prepared for checkout.",
                        redirectToCheckout: true
                      })
                    }
                  >
                    <Zap aria-hidden="true" className="h-4 w-4" />
                    {buyNowMutation.isPending
                      ? "Preparing..."
                      : product.inStock
                        ? "Buy now"
                        : "Unavailable"}
                  </Button>
                </div>
              </div>

              {wishlistToast ? (
                <div
                  className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#b8e3de] bg-white px-4 py-2 text-sm font-semibold text-[#0f6f68] shadow-lg shadow-[#0f6f68]/15 md:bottom-8"
                  role="status"
                >
                  {wishlistToast}
                </div>
              ) : null}
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
    <div className="rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-2.5 shadow-sm shadow-[#0f6f68]/5 sm:p-3">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#e5f5f3] text-[#0f6f68] sm:h-8 sm:w-8">
        <Icon aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </span>
      <p className="mt-1.5 text-[11px] font-semibold text-[#123432] sm:mt-2 sm:text-xs">
        {title}
      </p>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-[#607a77]">
        {value}
      </p>
    </div>
  );
}

function ProductSummary({ description }: { description: string }) {
  return (
    <>
      <div className="mt-5 rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] px-3.5 shadow-sm shadow-[#0f6f68]/5 sm:hidden">
        <details className="group" data-testid="mobile-product-summary">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-semibold text-[#123432]">Product summary</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#607a77]">
              <span
                className="group-open:hidden"
                data-testid="mobile-product-summary-ellipsis"
              >
                ...
              </span>
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 text-[#0f6f68] transition group-open:rotate-180"
              />
            </span>
          </summary>
          <div
            className="mt-2 grid gap-1 group-open:hidden"
            data-testid="mobile-product-summary-preview"
          >
            <div
              className="line-clamp-2 text-[13px] leading-5 text-[#607a77]"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </div>
          <div
            className="productDescriptionRichText mt-2 hidden text-[13px] leading-5 text-[#607a77] group-open:block"
            data-testid="mobile-product-summary-full"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </details>
      </div>

      <div
        className="mt-5 hidden rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0f6f68]/5 sm:block"
        data-testid="desktop-product-summary"
      >
        <h2 className="text-base font-semibold text-[#123432]">Product summary</h2>
        <div
          className="productDescriptionRichText mt-2 text-sm leading-6 text-[#607a77]"
          data-testid="desktop-product-summary-body"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      </div>
    </>
  );
}

function ProductFacts({ product }: { product: Product }) {
  const facts = [
    { label: "Sterile", value: product.sterile ? "Yes" : "No" },
    { label: "Disposable", value: product.disposable ? "Yes" : "No" },
    { label: "Material", value: product.material ?? "Not specified" },
    { label: "Pack size", value: product.packSize ?? "Not specified" },
    { label: "Unit", value: product.unit || "Not specified" },
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
          className="flex items-start justify-between gap-4 rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] px-4 py-3 shadow-sm shadow-[#0f6f68]/5"
          key={fact.label}
        >
          <span className="text-sm font-semibold text-[#607a77]">{fact.label}</span>
          <strong className="min-w-0 break-words text-right text-sm text-[#123432]">
            {fact.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ProductVariants({ product }: { product: Product }) {
  return (
    <section className="rounded-lg border border-[#c4e4e0] bg-white p-4 shadow-sm shadow-[#0f6f68]/5 xl:col-span-3">
      <SectionHeader
        description="Available pack, size, or SKU options from the product catalog."
        eyebrow="Variants"
        size="compact"
        title="Purchase options"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {product.variants.map((variant) => (
          <article
            className="rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-3 shadow-sm shadow-[#0f6f68]/5"
            key={variant.id}
          >
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#e5f5f3] text-[#0f6f68]">
                <Boxes aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold leading-5 text-[#123432]">
                  {variant.name}
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold uppercase text-[#607a77]">
                  SKU {variant.sku}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-base font-semibold tabular-nums text-[#123432]">
                {formatRupees(variant.sellingPrice)}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#2b4946]">
                {variant.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#607a77]">
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
    <section className="rounded-lg border border-[#c4e4e0] bg-white p-5 shadow-sm shadow-[#0f6f68]/5 xl:col-span-3">
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
              className="flex items-center justify-between gap-4 rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4 shadow-sm shadow-[#0f6f68]/5 transition hover:border-[#0f6f68]"
              href={document.fileUrl}
              key={document.id}
              rel="noreferrer"
              target="_blank"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#e5f5f3] text-[#0f6f68]">
                  <FileText aria-hidden="true" className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block text-[#123432] text-sm sm:text-normal">{document.title}</strong>
                  <span className="text-sm font-semibold text-[#607a77]">
                    {documentTypeLabel(document.type)}
                  </span>
                </span>
              </span>
              <Download
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-[#0f6f68]"
              />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function ProductFeedbackSection({
  feedback,
  feedbackMessage,
  question,
  questionError,
  questionPending,
  reviewComment,
  reviewError,
  reviewPending,
  reviewRating,
  setQuestion,
  setReviewComment,
  setReviewRating,
  onQuestionSubmit,
  onReviewSubmit
}: {
  feedback?: ProductFeedback;
  feedbackMessage?: string;
  question: string;
  questionError?: string;
  questionPending: boolean;
  reviewComment: string;
  reviewError?: string;
  reviewPending: boolean;
  reviewRating: number;
  setQuestion: (value: string) => void;
  setReviewComment: (value: string) => void;
  setReviewRating: (value: number) => void;
  onQuestionSubmit: () => void;
  onReviewSubmit: () => void;
}) {
  const reviews = feedback?.reviews ?? [];
  const questions = feedback?.questions ?? [];
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((total, review) => total + review.rating, 0) /
        reviews.length
      : null;

  return (
    <section className="rounded-lg border border-[#c4e4e0] bg-white p-4 shadow-sm shadow-[#0f6f68]/5 sm:p-5 xl:col-span-3">
      <SectionHeader
        description="Read recent buyer feedback or ask a product-specific question before purchase."
        eyebrow="Customer feedback"
        size="compact"
        title="Reviews and Q&A"
      />

      {feedbackMessage ? (
        <p
          className="mt-4 rounded-lg bg-[#e5f5f3] px-4 py-3 text-sm font-semibold text-[#0f6f68]"
          role="status"
        >
          {feedbackMessage}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 rounded-lg border border-[#d7efeb] bg-[#f8fbfa] p-3 text-xs font-semibold text-[#55716e] sm:grid-cols-3 sm:p-4">
        <div>
          <span className="block text-[11px] uppercase tracking-[0.12em] text-[#687f7c]">
            Average rating
          </span>
          <strong className="mt-1 block text-lg text-[#123432] font-normal">
            {averageRating ? `${averageRating.toFixed(1)}/5` : "No rating yet"}
          </strong>
        </div>
        <div>
          <span className="block text-[11px] uppercase tracking-[0.12em] text-[#687f7c]">
            Reviews
          </span>
          <strong className="mt-1 block text-lg text-[#123432] font-normal">
            {reviews.length}
          </strong>
        </div>
        <div>
          <span className="block text-[11px] uppercase tracking-[0.12em] text-[#687f7c]">
            Questions
          </span>
          <strong className="mt-1 block text-lg text-[#123432] font-normal">
            {questions.length}
          </strong>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#123432]">Reviews</h3>
            <span className="rounded-full bg-[#e5f5f3] px-2.5 py-1 text-[11px] font-semibold text-[#0f6f68]">
              {reviews.length} posted
            </span>
          </div>
          <div className="grid gap-3">
            {reviews.length > 0 ? (
              reviews.slice(0, 4).map((review) => (
                <article
                  className="rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4"
                  key={review.id}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e5f5f3] text-sm font-semibold uppercase text-[#0f6f68]">
                      {getCustomerInitials(review.customerName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          aria-label={`${review.rating} out of 5 stars`}
                          className="text-sm font-semibold tracking-[0.08em] text-[#f59e0b]"
                        >
                          {"★".repeat(review.rating)}
                          <span className="text-[#d4e2df]">
                            {"★".repeat(5 - review.rating)}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-[#607a77]">
                          {formatFeedbackDate(review.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#123432]">
                        {review.title ?? "Customer review"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#607a77]">
                    {review.comment}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-[#0f6f68]">
                    {review.customerName} · Customer
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[#c4e4e0] bg-[#f8fbfa] p-4 text-sm font-semibold text-[#607a77]">
                No reviews yet.
              </p>
            )}
          </div>
          <div className="grid gap-3 rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4">
            <div>
              <h4 className="text-sm font-semibold text-[#123432]">
                Write a review
              </h4>
              <p className="mt-1 text-xs font-semibold text-[#607a77]">
                Share what helped with purchase or clinical use.
              </p>
            </div>
            <select
              aria-label="Review rating"
              className="min-h-11 rounded-lg border border-[#cbdedb] bg-white px-3 text-sm font-semibold text-[#123432]"
              onChange={(event) => setReviewRating(Number(event.target.value))}
              value={reviewRating}
            >
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} star{rating === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <textarea
              aria-label="Review comment"
              className="min-h-24 rounded-lg border border-[#cbdedb] bg-white px-3 py-2 text-sm font-semibold text-[#123432]"
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Share purchase feedback"
              value={reviewComment}
            />
            {reviewError ? (
              <p className="text-sm font-semibold text-[#7a271a]" role="alert">
                {reviewError}
              </p>
            ) : null}
            <Button
              disabled={reviewPending}
              onClick={onReviewSubmit}
              type="button"
            >
              {reviewPending ? "Submitting..." : "Submit review"}
            </Button>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#123432]">Questions</h3>
            <span className="rounded-full bg-[#e5f5f3] px-2.5 py-1 text-[11px] font-semibold text-[#0f6f68]">
              {questions.length} asked
            </span>
          </div>
          <div className="grid gap-3">
            {questions.length > 0 ? (
              questions.slice(0, 4).map((entry) => (
                <article
                  className="rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4"
                  key={entry.id}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-[#0f6f68]">
                      Q
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0f6f68]">
                          Product question
                        </span>
                        <span className="text-xs font-semibold text-[#607a77]">
                          {formatFeedbackDate(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#123432]">
                        {entry.question}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-[#607a77]">
                    <span className="font-semibold text-[#123432]">Answer: </span>
                    {entry.answer ?? "Awaiting answer from the team."}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#607a77]">
                    {entry.customerName}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-[#c4e4e0] bg-[#f8fbfa] p-4 text-sm font-semibold text-[#607a77]">
                No questions yet.
              </p>
            )}
          </div>
          <div className="grid gap-3 rounded-lg border border-[#c4e4e0] bg-[#f8fbfa] p-4">
            <div>
              <h4 className="text-sm font-semibold text-[#123432]">
                Ask a question
              </h4>
              <p className="mt-1 text-xs font-semibold text-[#607a77]">
                Ask about fit, pack size, compatibility, or delivery.
              </p>
            </div>
            <textarea
              aria-label="Product question"
              className="min-h-24 rounded-lg border border-[#cbdedb] bg-white px-3 py-2 text-sm font-semibold text-[#123432]"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about compatibility, pack size, or delivery"
              value={question}
            />
            {questionError ? (
              <p className="text-sm font-semibold text-[#7a271a]" role="alert">
                {questionError}
              </p>
            ) : null}
            <Button
              disabled={questionPending}
              onClick={onQuestionSubmit}
              type="button"
              variant="outline"
            >
              {questionPending ? "Submitting..." : "Ask question"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function getCustomerInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "C";
}

function formatFeedbackDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
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
    .slice(0, 5);
  const similar = similarCategoryQuery.data?.items
    .filter((product) => product.id !== currentProductId)
    .slice(0, 5);

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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
            {related.map((product) => (
              <ProductCard compact key={product.id} product={product} />
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
            {similar.map((product) => (
              <ProductCard compact key={product.id} product={product} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
