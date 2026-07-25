import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { Product } from "@/lib/api/schemas";
import { formatRupees } from "@/lib/format";
import { cardStyle, colors, fonts } from "@/lib/theme";

export function ProductCard({
  compact = false,
  product
}: {
  compact?: boolean;
  product: Product;
}) {
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const savingsPercent =
    product.mrp > product.sellingPrice
      ? Math.round(((product.mrp - product.sellingPrice) / product.mrp) * 100)
      : 0;

  return (
    <Link
      asChild
      href={{ pathname: "/products/[slug]", params: { slug: product.slug } }}
    >
      <Pressable
        style={({ pressed }) => ({
          ...cardStyle,
          opacity: pressed ? 0.86 : 1,
          overflow: "hidden",
          width: compact ? 146 : "100%"
        })}
      >
        <View
          style={{
            alignItems: "center",
            aspectRatio: compact ? 1.5 : 1.25,
            backgroundColor: colors.background,
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
        </View>
        <View style={{ gap: 4, padding: 12 }}>
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
            selectable
            style={{
              color: colors.ink,
              fontFamily: fonts.headingBold,
              fontSize: 16,
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
              fontSize: 10
            }}
          >
            <Text style={{ textDecorationLine: "line-through" }}>
              {formatRupees(product.mrp)}
            </Text>
            {savingsPercent ? (
              <Text style={{ color: "#008F5F" }}> {savingsPercent}% OFF</Text>
            ) : null}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
