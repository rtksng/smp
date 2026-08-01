import { useEffect, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { ProductCard } from "@/components/product-card";
import { StoreHeader } from "@/components/store-header";
import { SectionHeader } from "@/components/ui/section-header";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import { getBrands, getCategories, getProducts } from "@/lib/api/catalog";
import type { Category } from "@/lib/api/schemas";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";
import mobileBanner1 from "@/assets/banners/mobile-banner-1.png";
import mobileBanner2 from "@/assets/banners/mobile-banner-2.png";
import mobileBanner3 from "@/assets/banners/mobile-banner-3.png";
import mobileBanner4 from "@/assets/banners/mobile-banner-4.png";
import mobileBanner5 from "@/assets/banners/mobile-banner-5.png";

const banners = [
  mobileBanner1,
  mobileBanner2,
  mobileBanner3,
  mobileBanner4,
  mobileBanner5
];

const fallbackCategoryIcons = [
  "gift-outline",
  "heart-pulse",
  "magnify",
  "view-grid-outline"
] as const;

export default function HomeScreen() {
  const categoriesQuery = useQuery({
    queryFn: getCategories,
    queryKey: queryKeys.categories
  });
  const brandsQuery = useQuery({
    queryFn: getBrands,
    queryKey: queryKeys.brands
  });
  const productsQuery = useQuery({
    queryFn: () => getProducts({ limit: 12, sort: "latest" }),
    queryKey: queryKeys.products({ limit: 12, sort: "latest" })
  });
  const isLoading =
    categoriesQuery.isLoading || brandsQuery.isLoading || productsQuery.isLoading;
  const firstError =
    categoriesQuery.error ?? brandsQuery.error ?? productsQuery.error ?? null;

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <StoreHeader />
      <ScrollView
        contentContainerStyle={{ gap: 20, paddingBottom: 28 }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={undefined}
      >
        <BannerCarousel />
        {isLoading ? (
          <View style={{ paddingHorizontal: 16 }}>
            <LoadingState label="Loading the catalog" />
          </View>
        ) : null}
        {firstError ? (
          <View style={{ paddingHorizontal: 16 }}>
            <ErrorState
              message={getErrorMessage(firstError, "Unable to load the catalog.")}
              onRetry={() => {
                void categoriesQuery.refetch();
                void brandsQuery.refetch();
                void productsQuery.refetch();
              }}
              title="Unable to load the store"
            />
          </View>
        ) : null}
        {categoriesQuery.data ? (
          <CategoryRail categories={categoriesQuery.data} />
        ) : null}
        {categoriesQuery.data ? (
          <FeaturedCategoryRails categories={categoriesQuery.data.slice(0, 3)} />
        ) : null}
        {brandsQuery.data ? <BrandRail brands={brandsQuery.data} /> : null}
        {productsQuery.data?.items.length ? (
          <ProductRail products={productsQuery.data.items} title="Latest additions" />
        ) : null}
        <TrustRail />
      </ScrollView>
    </View>
  );
}

function BannerCarousel() {
  const listRef = useRef<FlatList<(typeof banners)[number]>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width } = useWindowDimensions();
  const carouselWidth = Math.min(width, 980);
  const itemWidth = carouselWidth - 32;

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % banners.length;
        listRef.current?.scrollToIndex({ animated: true, index: next });
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  return (
    <View
      style={{
        alignSelf: "center",
        maxWidth: 980,
        paddingHorizontal: 16,
        paddingTop: 12,
        width: "100%"
      }}
    >
      <View
        style={{
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: 12,
          borderWidth: 1,
          height: 160,
          overflow: "hidden",
          width: itemWidth
        }}
      >
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={banners}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            index,
            length: itemWidth,
            offset: itemWidth * index
          })}
          horizontal
          keyExtractor={(_, index) => String(index)}
          onMomentumScrollEnd={(event) =>
            setActiveIndex(
              Math.min(
                banners.length - 1,
                Math.max(
                  0,
                  Math.round(event.nativeEvent.contentOffset.x / itemWidth)
                )
              )
            )
          }
          pagingEnabled
          ref={listRef}
          renderItem={({ item }) => (
            <Image
              contentFit="cover"
              source={item}
              style={{ height: 160, width: itemWidth }}
            />
          )}
          showsHorizontalScrollIndicator={false}
        />
        <View
          style={{
            bottom: 8,
            flexDirection: "row",
            gap: 6,
            justifyContent: "center",
            left: 0,
            position: "absolute",
            right: 0
          }}
        >
          {banners.map((_, index) => (
            <Pressable
              accessibilityLabel={`Show banner ${index + 1}`}
              accessibilityRole="button"
              accessibilityState={{ selected: index === activeIndex }}
              hitSlop={8}
              key={index}
              onPress={() => {
                setActiveIndex(index);
                listRef.current?.scrollToIndex({ animated: true, index });
              }}
              style={{
                backgroundColor:
                  index === activeIndex ? colors.primaryDark : "rgba(255,255,255,0.8)",
                borderRadius: 4,
                height: 8,
                width: index === activeIndex ? 20 : 8
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function CategoryRail({ categories }: { categories: Category[] }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader title="Shop by Category" />
      </View>
      <FlatList
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
        data={categories.filter((category) => category.isActive).slice(0, 10)}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={({ index, item }) => (
          <Link
            asChild
            href={{
              pathname: "/search",
              params: { category: item.slug, title: item.name }
            }}
          >
            <Pressable
              style={{
                ...cardStyle,
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
                minHeight: 112,
                padding: 10,
                width: 104
              }}
            >
              {item.imageUrl ? (
                <Image
                  accessibilityLabel={item.name}
                  contentFit="cover"
                  source={{ uri: item.imageUrl }}
                  style={{ borderRadius: 9, height: 48, width: 48 }}
                />
              ) : (
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.primarySoft,
                    borderRadius: 12,
                    height: 48,
                    justifyContent: "center",
                    width: 48
                  }}
                >
                  <MaterialCommunityIcons
                    color={colors.primaryDark}
                    name={
                      fallbackCategoryIcons[
                        index % fallbackCategoryIcons.length
                      ] ?? "view-grid-outline"
                    }
                    size={24}
                  />
                </View>
              )}
              <Text
                numberOfLines={2}
                selectable
                style={{
                  color: colors.text,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 12,
                  textAlign: "center"
                }}
              >
                {item.name}
              </Text>
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderColor: "#C7EACB",
                  borderCurve: "continuous",
                  borderRadius: 999,
                  borderWidth: 1,
                  minHeight: 24,
                  paddingHorizontal: 10,
                  paddingVertical: 4
                }}
              >
                <Text
                  selectable
                  style={{
                    color: colors.primaryDark,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 10
                  }}
                >
                  Open catalog
                </Text>
              </View>
            </Pressable>
          </Link>
        )}
        showsHorizontalScrollIndicator={false}
      />
      <View style={{ alignItems: "center" }}>
        <Link asChild href="/search">
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderColor: "#A9DDAE",
              borderRadius: 10,
              borderWidth: 1,
              minHeight: 44,
              paddingHorizontal: 24,
              paddingVertical: 12
            }}
          >
            <Text
              selectable
              style={{
                color: colors.primaryDark,
                fontFamily: fonts.bodySemiBold,
                fontSize: 12
              }}
            >
              Browse all categories
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function FeaturedCategoryRails({ categories }: { categories: Category[] }) {
  const queries = useQueries({
    queries: categories.map((category) => ({
      queryFn: () => getProducts({ category: category.slug, limit: 6 }),
      queryKey: queryKeys.products({ category: category.slug, limit: 6 })
    }))
  });

  return (
    <View style={{ gap: 20 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader
          actionHref="/search"
          actionText="View all"
          title="Featured products by category"
        />
      </View>
      {categories.map((category, index) => {
        const products = queries[index]?.data?.items ?? [];

        if (!products.length) {
          return null;
        }

        return (
          <View key={category.id} style={{ gap: 10 }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: 16
              }}
            >
              <Text
                selectable
                style={{
                  color: colors.text,
                  fontFamily: fonts.heading,
                  fontSize: 16
                }}
              >
                {category.name}
              </Text>
              <Link
                asChild
                href={{
                  pathname: "/search",
                  params: { category: category.slug, title: category.name }
                }}
              >
                <Pressable
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.surface,
                    borderColor: "#C7EACB",
                    borderCurve: "continuous",
                    borderRadius: 999,
                    borderWidth: 1,
                    justifyContent: "center",
                    minHeight: 32,
                    paddingHorizontal: 12
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
                    Open Catalog
                  </Text>
                </Pressable>
              </Link>
            </View>
            <FlatList
              contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
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
          </View>
        );
      })}
    </View>
  );
}

function BrandRail({
  brands
}: {
  brands: Awaited<ReturnType<typeof getBrands>>;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader
          actionHref="/search"
          actionText="View all brands"
          title="Top Brands"
        />
      </View>
      <FlatList
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
        data={brands.filter((brand) => brand.isActive).slice(0, 10)}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link
            asChild
            href={{ pathname: "/search", params: { brand: item.slug } }}
          >
            <Pressable
              style={{
                ...cardStyle,
                alignItems: "center",
                gap: 8,
                justifyContent: "center",
                minHeight: 96,
                padding: 12,
                width: 96
              }}
            >
              {item.logoUrl ? (
                <Image
                  accessibilityLabel={item.name}
                  contentFit="contain"
                  source={{ uri: item.logoUrl }}
                  style={{ height: 34, width: 72 }}
                />
              ) : (
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.primarySoft,
                    borderRadius: 9,
                    height: 38,
                    justifyContent: "center",
                    width: 38
                  }}
                >
                  <Text
                    selectable
                    style={{
                      color: colors.primaryDark,
                      fontFamily: fonts.headingBold
                    }}
                  >
                    {item.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                numberOfLines={1}
                selectable
                style={{
                  color: colors.text,
                  fontFamily: fonts.bodySemiBold,
                  fontSize: 11
                }}
              >
                {item.name}
              </Text>
            </Pressable>
          </Link>
        )}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

function ProductRail({
  products,
  title
}: {
  products: Awaited<ReturnType<typeof getProducts>>["items"];
  title: string;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader actionHref="/search" actionText="View All" title={title} />
      </View>
      <FlatList
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
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
    </View>
  );
}

function TrustRail() {
  const items = [
    ["shield-check-outline", "Verified Products", "Quality checked"],
    ["receipt-text-check-outline", "GST Ready", "Invoice support"],
    ["truck-fast-outline", "Fast Delivery", "Shown at checkout"]
  ] as const;

  return (
    <FlatList
      contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
      data={items}
      horizontal
      keyExtractor={(item) => item[1]}
      renderItem={({ item }) => (
        <View
          style={{
            ...cardStyle,
            alignItems: "center",
            flexDirection: "row",
            gap: 10,
            minHeight: 68,
            padding: 12,
            width: 176
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: "#FFF3E3",
              borderRadius: 10,
              height: 40,
              justifyContent: "center",
              width: 40
            }}
          >
            <MaterialCommunityIcons color="#D26812" name={item[0]} size={21} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              selectable
              style={{
                color: colors.text,
                fontFamily: fonts.bodySemiBold,
                fontSize: 13
              }}
            >
              {item[1]}
            </Text>
            <Text
              selectable
              style={{
                color: colors.muted,
                fontFamily: fonts.bodySemiBold,
                fontSize: 10
              }}
            >
              {item[2]}
            </Text>
          </View>
        </View>
      )}
      showsHorizontalScrollIndicator={false}
    />
  );
}
