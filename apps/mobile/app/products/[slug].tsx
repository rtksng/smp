import { useState, type ReactNode } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import { addCartItem, buyNow } from "@/lib/api/cart";
import {
  getProduct,
  getRelatedProducts,
  getSimilarProducts
} from "@/lib/api/catalog";
import {
  createProductQuestion,
  createProductReview,
  getProductFeedback,
  type ProductFeedback
} from "@/lib/api/product-feedback";
import type { Product } from "@/lib/api/schemas";
import {
  addWishlistItem,
  getWishlist,
  removeWishlistItem
} from "@/lib/api/wishlist";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatCatalogRupees, formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const productQuery = useQuery({
    enabled: Boolean(slug),
    queryFn: () => getProduct(slug),
    queryKey: queryKeys.product(slug)
  });
  const product = productQuery.data;
  const feedbackQuery = useQuery({
    enabled: Boolean(product?.slug),
    queryFn: () => getProductFeedback(product?.slug ?? slug),
    queryKey: queryKeys.productFeedback(product?.slug ?? slug)
  });
  const relatedProductsQuery = useQuery({
    enabled: Boolean(product?.slug),
    queryFn: () => getRelatedProducts(product?.slug ?? slug, 5),
    queryKey: queryKeys.relatedProducts(product?.slug ?? slug)
  });
  const similarProductsQuery = useQuery({
    enabled: Boolean(product?.slug),
    queryFn: () => getSimilarProducts(product?.slug ?? slug, 5),
    queryKey: queryKeys.similarProducts(product?.slug ?? slug)
  });
  const wishlistQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getWishlist,
    queryKey: queryKeys.wishlist
  });
  const isWishlisted = Boolean(
    product && wishlistQuery.data?.items.some((item) => item.id === product.id)
  );
  const selectedImage =
    product?.images.find((image) => image.id === selectedImageId) ??
    product?.images.find((image) => image.isPrimary) ??
    product?.images[0];
  const cartMutation = useMutation({
    mutationFn: (buyNowFlow: boolean) => {
      if (!product) {
        throw new Error("Product is unavailable.");
      }

      const input = { productId: product.id, quantity, variantId: null };
      return buyNowFlow ? buyNow(input) : addCartItem(input);
    },
    onSuccess: async (_, buyNowFlow) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart() });

      if (buyNowFlow) {
        router.push("/checkout");
      } else {
        setMessage("Added to cart.");
      }
    }
  });
  const wishlistMutation = useMutation({
    mutationFn: (remove: boolean) => {
      if (!product) {
        throw new Error("Product is unavailable.");
      }

      return remove
        ? removeWishlistItem(product.id)
        : addWishlistItem(product.id);
    },
    onSuccess: (wishlist, remove) => {
      queryClient.setQueryData(queryKeys.wishlist, wishlist);
      setMessage(remove ? "Removed from wishlist." : "Added to wishlist.");
    }
  });
  const reviewMutation = useMutation({
    mutationFn: () =>
      createProductReview(product?.slug ?? slug, {
        comment: reviewComment,
        rating: reviewRating
      }),
    onSuccess: (feedback) => {
      queryClient.setQueryData(
        queryKeys.productFeedback(product?.slug ?? slug),
        feedback
      );
      setReviewComment("");
      setFeedbackMessage("Review submitted.");
    }
  });
  const questionMutation = useMutation({
    mutationFn: () =>
      createProductQuestion(product?.slug ?? slug, { question }),
    onSuccess: (feedback) => {
      queryClient.setQueryData(
        queryKeys.productFeedback(product?.slug ?? slug),
        feedback
      );
      setQuestion("");
      setFeedbackMessage("Question submitted.");
    }
  });

  function handleCartAction(buyNowFlow: boolean) {
    if (!session) {
      router.push({
        pathname: "/login",
        params: { returnTo: `/products/${slug}` }
      });
      return;
    }

    setMessage(null);
    cartMutation.mutate(buyNowFlow);
  }

  function handleWishlist() {
    if (!session) {
      router.push({
        pathname: "/login",
        params: { returnTo: `/products/${slug}` }
      });
      return;
    }

    setMessage(null);
    wishlistMutation.mutate(isWishlisted);
  }

  function handleFeedbackSubmit(kind: "question" | "review") {
    if (!session) {
      router.push({
        pathname: "/login",
        params: { returnTo: `/products/${slug}` }
      });
      return;
    }

    setFeedbackMessage(null);
    if (kind === "review") {
      reviewMutation.mutate();
    } else {
      questionMutation.mutate();
    }
  }

  if (productQuery.isLoading) {
    return (
      <View style={{ padding: 16 }}>
        <LoadingState label="Loading product" />
      </View>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorState
          message={getErrorMessage(productQuery.error, "Unable to load product.")}
          onRetry={() => void productQuery.refetch()}
          title="Unable to load product"
        />
      </View>
    );
  }

  const relatedProducts =
    relatedProductsQuery.data?.items
      .filter((item) => item.id !== product.id)
      .slice(0, 5) ?? [];
  const similarProducts =
    similarProductsQuery.data?.items
      .filter((item) => item.id !== product.id)
      .slice(0, 5) ?? [];
  const visibleDocuments = product.documents.filter((document) =>
    ["CERTIFICATE", "MANUAL", "WARRANTY", "COMPLIANCE"].includes(document.type)
  );
  const productSummary = product.description
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <KeyboardAwareScrollView
        bottomOffset={96}
        contentContainerStyle={{
          alignSelf: "center",
          gap: 20,
          maxWidth: 980,
          padding: 16,
          paddingBottom: 132 + insets.bottom,
          width: "100%"
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
          <Pressable
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderColor: colors.border,
              borderRadius: 999,
              borderWidth: 1,
              height: 32,
              justifyContent: "center",
              width: 40
            })}
          >
            <MaterialCommunityIcons color={colors.primaryDark} name="arrow-left" size={18} />
          </Pressable>
          <View accessibilityLabel="Product breadcrumbs" style={{ alignItems: "center", flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, minHeight: 32 }}>
            <Pressable onPress={() => router.push("/search")}><Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Products</Text></Pressable>
            <MaterialCommunityIcons color="#A3B1AD" name="chevron-right" size={16} />
            <Pressable onPress={() => router.push({ pathname: "/search", params: { category: product.category.slug } })}><Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{product.category.name}</Text></Pressable>
            <MaterialCommunityIcons color="#A3B1AD" name="chevron-right" size={16} />
            <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{product.name}</Text>
          </View>
        </View>
        <View
          style={{
            ...cardStyle,
            alignItems: "center",
            alignSelf: "center",
            aspectRatio: 1,
            justifyContent: "center",
            maxWidth: 620,
            overflow: "hidden",
            width: "100%"
          }}
        >
          {selectedImage ? (
            <View style={{ alignSelf: "stretch", flex: 1, margin: 16 }}>
              <Image
                accessibilityLabel={selectedImage.altText ?? product.name}
                contentFit="contain"
                source={{ uri: selectedImage.url }}
                style={{ height: "100%", width: "100%" }}
                transition={180}
              />
            </View>
          ) : (
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="medical-bag"
              size={72}
            />
          )}
          <Pressable
            accessibilityLabel={
              isWishlisted ? "Remove from wishlist" : "Add to wishlist"
            }
            accessibilityState={{ checked: isWishlisted }}
            disabled={wishlistMutation.isPending}
            onPress={handleWishlist}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: 999,
              borderWidth: 1,
              height: 44,
              justifyContent: "center",
              opacity: pressed ? 0.82 : 1,
              position: "absolute",
              right: 12,
              top: 12,
              width: 44
            })}
          >
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name={isWishlisted ? "heart" : "heart-outline"}
              size={22}
            />
          </Pressable>
        </View>

        {product.images.length > 1 ? (
          <FlatList
            contentContainerStyle={{ gap: 12 }}
            data={product.images}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedImageId(item.id)}
                style={{
                  backgroundColor: colors.surface,
                  borderColor:
                    item.id === selectedImage?.id
                      ? colors.primaryDark
                      : colors.border,
                  borderRadius: 8,
                  borderWidth: item.id === selectedImage?.id ? 2 : 1,
                  height: 80,
                  overflow: "hidden",
                  width: 80
                }}
              >
                <View style={{ flex: 1, padding: 8 }}><Image accessibilityLabel={item.altText ?? product.name} contentFit="contain" source={{ uri: item.url }} style={{ height: "100%", width: "100%" }} /></View>
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
          />
        ) : null}

        <View style={{ ...cardStyle, gap: 12, padding: 16 }}>
          <Text
            selectable
            style={{
              color: colors.gold,
              fontFamily: fonts.bodySemiBold,
              fontSize: 11,
              textTransform: "uppercase"
            }}
          >
            {product.brand.name}
          </Text>
          <Text
            selectable
            style={{
              color: colors.ink,
              fontFamily: fonts.heading,
              fontSize: 18,
              lineHeight: 25
            }}
          >
            {product.name}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <Tag label={`SKU ${product.sku}`} />
            <Tag label={product.category.name} primary />
            {product.subcategory ? <Tag label={product.subcategory.name} primary /> : null}
            <Tag
              label={product.inStock ? "In stock" : "Product out of stock"}
            />
          </View>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 13,
              lineHeight: 21
            }}
          >
            {product.shortDescription}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <ProductSignal
              icon="receipt-text-check-outline"
              title="GST invoice"
              value={`${product.taxRate}% tax rate`}
            />
            <ProductSignal
              icon="truck-outline"
              title="Delivery"
              value="Estimate shown at checkout"
            />
            <ProductSignal
              icon="medical-bag"
              title="Clinical use"
              value={product.medicalSpecialty ?? "General medical use"}
            />
            <ProductSignal
              icon="shield-check-outline"
              title="Pack and safety"
              value={product.packSize ?? product.unit}
            />
          </View>
        </View>

        <Pressable
          accessibilityLabel="Product summary"
          accessibilityState={{ expanded: summaryExpanded }}
          onPress={() => setSummaryExpanded((current) => !current)}
          style={{ ...cardStyle, gap: 8, padding: 14 }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between"
            }}
          >
            <Text
              selectable
              style={{
                color: colors.ink,
                fontFamily: fonts.heading,
                fontSize: 15
              }}
            >
              Product summary
            </Text>
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name={summaryExpanded ? "chevron-up" : "chevron-down"}
              size={20}
            />
          </View>
          <Text
            numberOfLines={summaryExpanded ? undefined : 2}
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 13,
              lineHeight: 21
            }}
          >
            {productSummary}
          </Text>
        </Pressable>

        <View style={{ ...cardStyle, gap: 13, padding: 16 }}>
          <Text
            selectable
            style={{
              color: colors.gold,
              fontFamily: fonts.bodySemiBold,
              fontSize: 11,
              textTransform: "uppercase"
            }}
          >
            Purchase panel
          </Text>
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              gap: 4,
              padding: 14
            }}
          >
            <Text
              selectable
              style={{
                color: colors.muted,
                fontFamily: fonts.bodySemiBold,
                fontSize: 11
              }}
            >
              Hospital price
            </Text>
            <Text
              selectable
              style={{
                color: colors.ink,
                fontFamily: fonts.headingBold,
                fontSize: 23,
                fontVariant: ["tabular-nums"]
              }}
            >
              {formatCatalogRupees(product.sellingPrice)}
            </Text>
            <Text
              selectable
              style={{
                color: colors.muted,
                fontFamily: fonts.bodySemiBold,
                fontSize: 12,
                textDecorationLine: "line-through"
              }}
            >
              MRP {formatCatalogRupees(product.mrp)}
            </Text>
            {product.mrp > product.sellingPrice ? (
              <Text
                selectable
                style={{
                  color: colors.primaryDark,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 12
                }}
              >
                Save {formatCatalogRupees(product.mrp - product.sellingPrice)}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              alignItems: "center",
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              padding: 10
            }}
          >
            <Text
              selectable
              style={{
                color: colors.text,
                fontFamily: fonts.bodySemiBold,
                fontSize: 13
              }}
            >
              Quantity
            </Text>
            <View
              style={{
                alignItems: "center",
                borderColor: "#CFDCDA",
                borderRadius: 10,
                borderWidth: 1,
                flexDirection: "row",
                overflow: "hidden"
              }}
            >
              <QuantityButton
                icon="minus"
                onPress={() => setQuantity((value) => Math.max(1, value - 1))}
              />
              <Text
                selectable
                style={{
                  color: colors.ink,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 14,
                  fontVariant: ["tabular-nums"],
                  minWidth: 42,
                  textAlign: "center"
                }}
              >
                {quantity}
              </Text>
              <QuantityButton
                icon="plus"
                onPress={() => setQuantity((value) => Math.min(999, value + 1))}
              />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <PurchaseNote
              icon="cash-multiple"
              label="COD and online payment at checkout"
            />
            <PurchaseNote
              icon="sale"
              label="Bulk price support for quantity orders"
            />
          </View>
          {!product.inStock ? (
            <Text
              accessibilityRole="alert"
              selectable
              style={{
                backgroundColor: colors.dangerBackground,
                borderRadius: 10,
                color: colors.danger,
                fontFamily: fonts.bodySemiBold,
                padding: 12
              }}
            >
              This product is currently out of stock.
            </Text>
          ) : null}
          {message || cartMutation.error ? (
            <Text
              accessibilityRole="alert"
              selectable
              style={{
                backgroundColor: cartMutation.error
                  ? colors.dangerBackground
                  : colors.primarySoft,
                borderRadius: 10,
                color: cartMutation.error ? colors.danger : colors.primaryDark,
                fontFamily: fonts.bodySemiBold,
                padding: 12
              }}
            >
              {cartMutation.error
                ? getErrorMessage(cartMutation.error, "Unable to update cart.")
                : message}
            </Text>
          ) : null}
        </View>

        <MedicalDetails product={product} />

        {product.variants.length > 0 ? (
          <ProductVariants product={product} />
        ) : null}

        <ProductDocuments documents={visibleDocuments} />

        <ProductFeedbackSection
          error={
            reviewMutation.error ??
            questionMutation.error ??
            feedbackQuery.error
          }
          feedback={feedbackQuery.data}
          loading={feedbackQuery.isLoading}
          message={feedbackMessage}
          onQuestionChange={setQuestion}
          onQuestionSubmit={() => handleFeedbackSubmit("question")}
          onRatingChange={setReviewRating}
          onReviewChange={setReviewComment}
          onReviewSubmit={() => handleFeedbackSubmit("review")}
          question={question}
          questionPending={questionMutation.isPending}
          reviewComment={reviewComment}
          reviewPending={reviewMutation.isPending}
          reviewRating={reviewRating}
        />

        <RecommendationSection
          error={relatedProductsQuery.error}
          loading={relatedProductsQuery.isLoading}
          products={relatedProducts}
          title="Related products"
        />

        <RecommendationSection
          error={similarProductsQuery.error}
          loading={similarProductsQuery.isLoading}
          products={similarProducts}
          title="Similar category products"
        />
      </KeyboardAwareScrollView>

      <View
        style={{
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          bottom: 0,
          left: 0,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingHorizontal: 12,
          paddingTop: 12,
          position: "absolute",
          right: 0
        }}
      >
        <View
          style={{
            alignSelf: "center",
            flexDirection: "row",
            gap: 10,
            maxWidth: 980,
            width: "100%"
          }}
        >
          <View style={{ flex: 1 }}>
            <Button
              disabled={!product.inStock}
              loading={cartMutation.isPending && cartMutation.variables === false}
              onPress={() => handleCartAction(false)}
              variant="outline"
            >
              Add to cart
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              disabled={!product.inStock}
              loading={cartMutation.isPending && cartMutation.variables === true}
              onPress={() => handleCartAction(true)}
            >
              Buy now
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

function PurchaseNote({
  icon,
  label
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
      <MaterialCommunityIcons
        color={colors.primaryDark}
        name={icon}
        size={17}
      />
      <Text
        selectable
        style={{
          color: colors.muted,
          flex: 1,
          fontFamily: fonts.bodySemiBold,
          fontSize: 11
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MedicalDetails({ product }: { product: Product }) {
  const facts = [
    ["Sterile", product.sterile ? "Yes" : "No"],
    ["Disposable", product.disposable ? "Yes" : "No"],
    ["Material", product.material ?? "Not specified"],
    ["Pack size", product.packSize ?? "Not specified"],
    ["Unit", product.unit],
    [
      "Medical specialty",
      product.medicalSpecialty ?? "General medical use"
    ],
    ["Expiry sensitive", product.expirySensitive ? "Yes" : "No"]
  ];

  return (
    <View style={{ ...cardStyle, gap: 14, padding: 16 }}>
      <SectionTitle
        description="Technical details for clinical review and purchase approval."
        eyebrow="Product information"
        title="Medical details"
      />
      <View style={{ gap: 9 }}>
        {facts.map(([label, value]) => (
          <View
            key={label}
            style={{
              alignItems: "flex-start",
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              flexDirection: "row",
              gap: 12,
              justifyContent: "space-between",
              padding: 12
            }}
          >
            <Text
              selectable
              style={{
                color: colors.muted,
                flex: 1,
                fontFamily: fonts.bodySemiBold,
                fontSize: 12
              }}
            >
              {label}
            </Text>
            <Text
              selectable
              style={{
                color: colors.text,
                flex: 1,
                fontFamily: fonts.bodySemiBold,
                fontSize: 12,
                textAlign: "right"
              }}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProductVariants({ product }: { product: Product }) {
  return (
    <View style={{ ...cardStyle, gap: 14, padding: 16 }}>
      <SectionTitle
        description="Available pack, size, or SKU options from the catalog."
        eyebrow="Variants"
        title="Purchase options"
      />
      <View style={{ gap: 9 }}>
        {product.variants.map((variant) => (
          <View
            key={variant.id}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: 10,
              borderWidth: 1,
              gap: 10,
              padding: 12
            }}
          >
            <View
              style={{
                alignItems: "flex-start",
                flexDirection: "row",
                gap: 10
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: colors.primarySoft,
                  borderRadius: 8,
                  height: 34,
                  justifyContent: "center",
                  width: 34
                }}
              >
                <MaterialCommunityIcons
                  color={colors.primaryDark}
                  name="package-variant-closed"
                  size={18}
                />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  selectable
                  style={{
                    color: colors.text,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 13
                  }}
                >
                  {variant.name}
                </Text>
                <Text
                  selectable
                  style={{
                    color: colors.muted,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 10,
                    textTransform: "uppercase"
                  }}
                >
                  SKU {variant.sku}
                </Text>
              </View>
            </View>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between"
              }}
            >
              <Text
                selectable
                style={{
                  color: colors.text,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 15,
                  fontVariant: ["tabular-nums"]
                }}
              >
                {formatCatalogRupees(variant.sellingPrice)}
              </Text>
              <Tag label={variant.status.replaceAll("_", " ")} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProductDocuments({
  documents
}: {
  documents: Product["documents"];
}) {
  return (
    <View style={{ ...cardStyle, gap: 14, padding: 16 }}>
      <SectionTitle
        description="Certificates, manuals, warranty, and compliance files."
        eyebrow="Documents"
        title="Product documents"
      />
      {documents.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: 10,
            borderStyle: "dashed",
            borderWidth: 1,
            gap: 4,
            padding: 14
          }}
        >
          <Text
            selectable
            style={{
              color: colors.text,
              fontFamily: fonts.bodySemiBold,
              fontSize: 13
            }}
          >
            No documents available
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 12,
              lineHeight: 18
            }}
          >
            No customer-visible product document is attached yet.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 9 }}>
          {documents.map((document) => (
            <Pressable
              accessibilityHint="Opens the document"
              accessibilityRole="link"
              key={document.id}
              onPress={() => void Linking.openURL(document.fileUrl)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                borderRadius: 10,
                borderWidth: 1,
                flexDirection: "row",
                gap: 11,
                opacity: pressed ? 0.82 : 1,
                padding: 12
              })}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: colors.primarySoft,
                  borderRadius: 8,
                  height: 40,
                  justifyContent: "center",
                  width: 40
                }}
              >
                <MaterialCommunityIcons
                  color={colors.primaryDark}
                  name="file-document-outline"
                  size={20}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  selectable
                  style={{
                    color: colors.text,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 13
                  }}
                >
                  {document.title}
                </Text>
                <Text
                  selectable
                  style={{
                    color: colors.muted,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 11
                  }}
                >
                  {documentTypeLabel(document.type)}
                </Text>
              </View>
              <MaterialCommunityIcons
                color={colors.primaryDark}
                name="download-outline"
                size={21}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ProductFeedbackSection({
  error,
  feedback,
  loading,
  message,
  onQuestionChange,
  onQuestionSubmit,
  onRatingChange,
  onReviewChange,
  onReviewSubmit,
  question,
  questionPending,
  reviewComment,
  reviewPending,
  reviewRating
}: {
  error: unknown;
  feedback?: ProductFeedback;
  loading: boolean;
  message: string | null;
  onQuestionChange: (value: string) => void;
  onQuestionSubmit: () => void;
  onRatingChange: (value: number) => void;
  onReviewChange: (value: string) => void;
  onReviewSubmit: () => void;
  question: string;
  questionPending: boolean;
  reviewComment: string;
  reviewPending: boolean;
  reviewRating: number;
}) {
  const reviews = feedback?.reviews ?? [];
  const questions = feedback?.questions ?? [];
  const averageRating = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : null;

  return (
    <View style={{ ...cardStyle, gap: 16, padding: 16 }}>
      <SectionTitle
        description="Read recent buyer feedback or ask a product-specific question before purchase."
        eyebrow="Customer feedback"
        title="Reviews and Q&A"
      />
      <View style={{ backgroundColor: colors.surfaceMuted, borderColor: "#DCEFE0", borderRadius: 8, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 }}>
        <FeedbackMetric label="Average rating" value={averageRating ? `${averageRating.toFixed(1)}/5` : "No rating yet"} />
        <FeedbackMetric label="Reviews" value={String(reviews.length)} />
        <FeedbackMetric label="Questions" value={String(questions.length)} />
      </View>
      {loading ? <LoadingState label="Loading product feedback" /> : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={{
            backgroundColor: colors.dangerBackground,
            borderRadius: 10,
            color: colors.danger,
            fontFamily: fonts.bodySemiBold,
            fontSize: 12,
            padding: 12
          }}
        >
          {getErrorMessage(error, "Unable to load or submit feedback.")}
        </Text>
      ) : null}
      {message ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={{
            backgroundColor: colors.primarySoft,
            borderRadius: 10,
            color: colors.primaryDark,
            fontFamily: fonts.bodySemiBold,
            fontSize: 12,
            padding: 12
          }}
        >
          {message}
        </Text>
      ) : null}

      <FeedbackGroup count={`${reviews.length} posted`} title="Reviews">
        {reviews.length > 0 ? (
          reviews.slice(0, 4).map((review) => <ReviewFeedbackCard key={review.id} review={review} />)
        ) : (
          <FeedbackEmpty label="No reviews yet." />
        )}
        <View style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 }}>
          <View style={{ gap: 4 }}>
            <Text selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Write a review</Text>
            <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Share what helped with purchase or clinical use.</Text>
          </View>
          <View
            accessibilityLabel={`Review rating ${reviewRating} out of 5`}
            style={{ flexDirection: "row", gap: 6 }}
          >
            {[1, 2, 3, 4, 5].map((rating) => (
              <Pressable
                accessibilityLabel={`${rating} star rating`}
                accessibilityState={{ selected: rating === reviewRating }}
                key={rating}
                onPress={() => onRatingChange(rating)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <MaterialCommunityIcons
                  color={colors.gold}
                  name={rating <= reviewRating ? "star" : "star-outline"}
                  size={25}
                />
              </Pressable>
            ))}
          </View>
          <FeedbackInput
            accessibilityLabel="Review comment"
            onChangeText={onReviewChange}
            placeholder="Share purchase feedback"
            value={reviewComment}
          />
          <Button
            disabled={reviewComment.trim().length < 5}
            loading={reviewPending}
            onPress={onReviewSubmit}
          >
            Submit review
          </Button>
        </View>
      </FeedbackGroup>

      <FeedbackGroup count={`${questions.length} asked`} title="Questions">
        {questions.length > 0 ? (
          questions.slice(0, 4).map((entry) => <QuestionFeedbackCard entry={entry} key={entry.id} />)
        ) : (
          <FeedbackEmpty label="No questions yet." />
        )}
        <View style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 }}>
          <View style={{ gap: 4 }}>
            <Text selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Ask a question</Text>
            <Text selectable style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Ask about fit, pack size, compatibility, or delivery.</Text>
          </View>
          <FeedbackInput
            accessibilityLabel="Product question"
            onChangeText={onQuestionChange}
            placeholder="Ask about compatibility, pack size, or delivery"
            value={question}
          />
          <Button
            disabled={question.trim().length < 5}
            loading={questionPending}
            onPress={onQuestionSubmit}
            variant="outline"
          >
            Ask question
          </Button>
        </View>
      </FeedbackGroup>
    </View>
  );
}

function FeedbackGroup({
  children,
  count,
  title
}: {
  children: ReactNode;
  count: string;
  title: string;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text selectable style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{title}</Text>
        <Text selectable style={{ backgroundColor: colors.primarySoft, borderRadius: 999, color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 11, paddingHorizontal: 10, paddingVertical: 5 }}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

function FeedbackMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexBasis: "30%", flexGrow: 1, gap: 4 }}>
      <Text selectable style={{ color: "#6F807A", fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</Text>
      <Text selectable style={{ color: colors.ink, fontFamily: fonts.body, fontSize: 18 }}>{value}</Text>
    </View>
  );
}

function ReviewFeedbackCard({ review }: { review: ProductFeedback["reviews"][number] }) {
  return (
    <View style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 }}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 18, height: 36, justifyContent: "center", width: 36 }}><Text style={{ color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 13, textTransform: "uppercase" }}>{customerInitials(review.customerName)}</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Text accessibilityLabel={`${review.rating} out of 5 stars`} style={{ color: "#F59E0B", fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{"★".repeat(review.rating)}<Text style={{ color: "#D8DFDC" }}>{"★".repeat(5 - review.rating)}</Text></Text>
            <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{formatDate(review.createdAt)}</Text>
          </View>
          <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{review.title ?? "Customer review"}</Text>
        </View>
      </View>
      <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 24 }}>{review.comment}</Text>
      <Text style={{ color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{review.customerName} · Verified customer</Text>
    </View>
  );
}

function QuestionFeedbackCard({ entry }: { entry: ProductFeedback["questions"][number] }) {
  return (
    <View style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 10, padding: 16 }}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: 18, height: 36, justifyContent: "center", width: 36 }}><Text style={{ color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Q</Text></View>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Text style={{ backgroundColor: colors.surface, borderRadius: 999, color: colors.primaryDark, fontFamily: fonts.bodySemiBold, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3 }}>Product question</Text><Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{formatDate(entry.createdAt)}</Text></View>
          <Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 24 }}>{entry.question}</Text>
        </View>
      </View>
      <Text style={{ backgroundColor: colors.surface, borderRadius: 8, color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 24, padding: 10 }}><Text style={{ color: colors.ink, fontFamily: fonts.bodySemiBold }}>Answer: </Text>{entry.answer ?? "Awaiting answer from the team."}</Text>
      <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{entry.customerName}</Text>
    </View>
  );
}

function customerInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

function FeedbackEmpty({ label }: { label: string }) {
  return (
    <Text
      selectable
      style={{
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderStyle: "dashed",
        borderWidth: 1,
        color: colors.muted,
        fontFamily: fonts.bodySemiBold,
        fontSize: 12,
        padding: 12
      }}
    >
      {label}
    </Text>
  );
}

function FeedbackInput({
  accessibilityLabel,
  onChangeText,
  placeholder,
  value
}: {
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      multiline
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#839084"
      selectionColor={colors.primaryDark}
      style={{
        backgroundColor: colors.surface,
        borderColor: "#CFDCDA",
        borderRadius: 8,
        borderWidth: 1,
        color: colors.text,
        fontFamily: fonts.body,
        fontSize: 14,
        minHeight: 92,
        padding: 12,
        textAlignVertical: "top"
      }}
      value={value}
    />
  );
}

function RecommendationSection({
  error,
  loading,
  products,
  title
}: {
  error: unknown;
  loading: boolean;
  products: Product[];
  title: string;
}) {
  if (!loading && !error && products.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 12 }}>
      <SectionTitle title={title} />
      {loading ? <LoadingState label={`Loading ${title.toLowerCase()}`} /> : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={{
            color: colors.danger,
            fontFamily: fonts.bodySemiBold,
            fontSize: 12
          }}
        >
          {getErrorMessage(error, `Unable to load ${title.toLowerCase()}.`)}
        </Text>
      ) : null}
      {products.length > 0 ? (
        <FlatList
          contentContainerStyle={{ gap: 12 }}
          data={products}
          horizontal
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ width: 146 }}>
              <ProductCard compact product={item} />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />
      ) : null}
    </View>
  );
}

function SectionTitle({
  description,
  eyebrow,
  title
}: {
  description?: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      {eyebrow ? (
        <Text
          selectable
          style={{
            color: colors.gold,
            fontFamily: fonts.bodySemiBold,
            fontSize: 10,
            textTransform: "uppercase"
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        selectable
        style={{
          color: colors.text,
          fontFamily: fonts.heading,
          fontSize: 17
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          selectable
          style={{
            color: colors.muted,
            fontFamily: fonts.body,
            fontSize: 12,
            lineHeight: 18
          }}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    CERTIFICATE: "Certificate",
    COMPLIANCE: "Compliance document",
    MANUAL: "Manual",
    WARRANTY: "Warranty document"
  };

  return labels[type] ?? "Product document";
}

function Tag({ label, primary = false }: { label: string; primary?: boolean }) {
  return (
    <Text
      selectable
      style={{
        backgroundColor: primary ? colors.primarySoft : "#EEF3F1",
        borderRadius: 999,
        color: primary ? colors.primaryDark : colors.text,
        fontFamily: fonts.bodySemiBold,
        fontSize: 10,
        paddingHorizontal: 10,
        paddingVertical: 6
      }}
    >
      {label}
    </Text>
  );
}

function ProductSignal({
  icon,
  title,
  value
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  value: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexBasis: "47%",
        flexGrow: 1,
        gap: 5,
        minHeight: 88,
        padding: 10
      }}
    >
      <MaterialCommunityIcons color={colors.primaryDark} name={icon} size={19} />
      <Text
        selectable
        style={{
          color: colors.text,
          fontFamily: fonts.bodySemiBold,
          fontSize: 11
        }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={2}
        selectable
        style={{
          color: colors.muted,
          fontFamily: fonts.body,
          fontSize: 10,
          lineHeight: 15
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function QuantityButton({
  icon,
  onPress
}: {
  icon: "minus" | "plus";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${icon === "plus" ? "Increase" : "Decrease"} quantity`}
      onPress={onPress}
      style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
    >
      <MaterialCommunityIcons color={colors.text} name={icon} size={18} />
    </Pressable>
  );
}
