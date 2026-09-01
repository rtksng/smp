import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, Text, View } from "react-native";
import { addCartItem } from "@/lib/api/cart";
import type { Product } from "@/lib/api/schemas";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { formatCatalogRupees } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

export function ProductCard({
  compact = false,
  product
}: {
  compact?: boolean;
  product: Product;
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const savingsPercent =
    product.mrp > product.sellingPrice
      ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)
      : 0;
  const cartMutation = useMutation({
    mutationFn: () =>
      addCartItem({ productId: product.id, quantity: 1, variantId: null }),
    onError: (error) => {
      Alert.alert(
        "Unable to add item",
        getErrorMessage(error, "Unable to add this product to the cart.")
      );
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKeys.cart(), cart);
      void queryClient.invalidateQueries({ queryKey: ["customer", "cart"] });
    }
  });

  function handleAddToCart() {
    if (!product.inStock || cartMutation.isPending) {
      return;
    }

    if (!session) {
      router.push({
        pathname: "/login",
        params: { returnTo: pathname || "/" }
      });
      return;
    }

    cartMutation.mutate();
  }

  return (
    <View
      style={{
        ...cardStyle,
        minHeight: compact ? 229 : undefined,
        overflow: "hidden",
        width: "100%"
      }}
    >
      <Pressable
        accessibilityLabel={`Open ${product.name}`}
        onPress={() =>
          router.push({
            pathname: "/products/[slug]",
            params: { slug: product.slug }
          })
        }
        style={({ pressed }) => ({
          flex: 1,
          opacity: pressed ? 0.84 : 1,
          width: "100%"
        })}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            height: compact ? 96 : undefined,
            aspectRatio: compact ? undefined : 1.25,
            justifyContent: "center"
          }}
        >
          {image ? (
            <Image
              accessibilityLabel={image.altText ?? product.name}
              contentFit="contain"
              source={{ uri: image.url }}
              style={{ height: "100%", width: "100%" }}
              transition={180}
            />
          ) : (
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="medical-bag"
              size={42}
            />
          )}
          {compact ? (
            <Pressable
              accessibilityLabel={`Add ${product.name} to cart`}
              accessibilityRole="button"
              accessibilityState={{
                busy: cartMutation.isPending,
                disabled: !product.inStock || cartMutation.isPending
              }}
              disabled={!product.inStock || cartMutation.isPending}
              onPress={(event) => {
                event.stopPropagation();
                handleAddToCart();
              }}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: colors.surface,
                borderColor: colors.primaryDark,
                borderCurve: "continuous",
                borderRadius: 8,
                borderWidth: 1,
                bottom: 8,
                justifyContent: "center",
                minHeight: 24,
                opacity:
                  !product.inStock || cartMutation.isPending
                    ? 0.6
                    : pressed
                      ? 0.78
                      : 1,
                paddingHorizontal: 8,
                paddingVertical: 2,
                position: "absolute",
                right: 8,
                zIndex: 2
              })}
            >
              <Text
                style={{
                  color: colors.primaryDark,
                  fontFamily: fonts.bodyMedium,
                  fontSize: 12,
                  lineHeight: 16
                }}
              >
                {cartMutation.isPending
                  ? "Adding..."
                  : product.inStock
                    ? "Add"
                    : "Out of stock"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: colors.surface,
            flex: compact ? 1 : undefined,
            gap: 4,
            padding: 12
          }}
        >
          <Text
            numberOfLines={1}
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.bodySemiBold,
              fontSize: 11
            }}
          >
            {product.brand.name}
          </Text>
          <Text
            numberOfLines={2}
            selectable
            style={{
              color: colors.text,
              fontFamily: fonts.heading,
              fontSize: 12,
              lineHeight: 18,
              minHeight: 36
            }}
          >
            {product.name}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            selectable
            style={{
              color: colors.ink,
              fontFamily: fonts.headingBold,
              fontSize: 16,
              fontVariant: ["tabular-nums"]
            }}
          >
            {formatCatalogRupees(product.sellingPrice)}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.bodySemiBold,
              fontSize: 11,
              lineHeight: 16
            }}
          >
            <Text style={{ textDecorationLine: "line-through" }}>
              MRP {formatCatalogRupees(product.mrp)}
            </Text>
            {savingsPercent ? (
              <Text style={{ color: "#17A89D" }}> {savingsPercent}% OFF</Text>
            ) : null}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
