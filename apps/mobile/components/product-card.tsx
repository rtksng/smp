import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
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
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.primaryDark,
                borderCurve: "continuous",
                borderRadius: 8,
                borderWidth: 1,
                bottom: 8,
                paddingHorizontal: 12,
                paddingVertical: 4,
                position: "absolute",
                right: 8
              }}
            >
              <Text
                selectable
                style={{
                  color: colors.primaryDark,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 11
                }}
              >
                View
              </Text>
            </View>
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
              fontSize: 11,
              lineHeight: 16
            }}
          >
            <Text style={{ textDecorationLine: "line-through" }}>
              MRP {formatRupees(product.mrp)}
            </Text>
            {savingsPercent ? (
              <Text style={{ color: "#008F5F" }}> {savingsPercent}% OFF</Text>
            ) : null}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
