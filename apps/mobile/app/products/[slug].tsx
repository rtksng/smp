import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import { addCartItem, buyNow } from "@/lib/api/cart";
import { getProduct } from "@/lib/api/catalog";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatRupees } from "@/lib/format";
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
  const productQuery = useQuery({
    enabled: Boolean(slug),
    queryFn: () => getProduct(slug),
    queryKey: queryKeys.product(slug)
  });
  const product = productQuery.data;
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

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          alignSelf: "center",
          gap: 14,
          maxWidth: 980,
          padding: 16,
          paddingBottom: 132 + insets.bottom,
          width: "100%"
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
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
            <Image
              accessibilityLabel={selectedImage.altText ?? product.name}
              contentFit="contain"
              source={{ uri: selectedImage.url }}
              style={{ height: "100%", width: "100%" }}
              transition={180}
            />
          ) : (
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="medical-bag"
              size={72}
            />
          )}
        </View>

        {product.images.length > 1 ? (
          <FlatList
            contentContainerStyle={{ gap: 10 }}
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
                  borderRadius: 10,
                  borderWidth: item.id === selectedImage?.id ? 2 : 1,
                  height: 72,
                  overflow: "hidden",
                  width: 72
                }}
              >
                <Image
                  accessibilityLabel={item.altText ?? product.name}
                  contentFit="contain"
                  source={{ uri: item.url }}
                  style={{ height: "100%", width: "100%" }}
                />
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
              fontSize: 21,
              lineHeight: 29
            }}
          >
            {product.name}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <Tag label={`SKU ${product.sku}`} />
            <Tag label={product.category.name} primary />
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
              value="Estimate at checkout"
            />
            <ProductSignal
              icon="shield-check-outline"
              title="Pack and safety"
              value={product.packSize ?? product.unit}
            />
            <ProductSignal
              icon="medical-bag"
              title="Clinical use"
              value={product.medicalSpecialty ?? "General medical use"}
            />
          </View>
        </View>

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
              {formatRupees(product.sellingPrice)}
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
              MRP {formatRupees(product.mrp)}
            </Text>
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

        <View style={{ ...cardStyle, gap: 8, padding: 16 }}>
          <Text
            selectable
            style={{
              color: colors.ink,
              fontFamily: fonts.heading,
              fontSize: 16
            }}
          >
            Product summary
          </Text>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.body,
              fontSize: 13,
              lineHeight: 21
            }}
          >
            {product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
          </Text>
        </View>
      </ScrollView>

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
