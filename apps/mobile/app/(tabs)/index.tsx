import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ComponentRef } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, type Href } from "expo-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import { getBrands, getCategories, getProducts } from "@/lib/api/catalog";
import {
  createQuoteRequest,
  quoteRequestInputSchema,
  type QuoteRequestInput
} from "@/lib/api/quotes";
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

const emptyQuoteForm: QuoteRequestInput = {
  email: "",
  message: "",
  mobileNumber: "",
  name: "",
  organization: null
};

export default function HomeScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const scrollRef = useRef<ComponentRef<typeof KeyboardAwareScrollView>>(null);
  const [bulkOffset, setBulkOffset] = useState(0);
  useEffect(() => {
    if (section === "bulk" && bulkOffset > 0) {
      scrollRef.current?.scrollTo({ y: bulkOffset, animated: true });
    }
  }, [section, bulkOffset]);
  const categoriesQuery = useQuery({
    queryFn: getCategories,
    queryKey: queryKeys.categories
  });
  const brandsQuery = useQuery({
    queryFn: getBrands,
    queryKey: queryKeys.brands
  });
  const productsQuery = useQuery({
    queryFn: () => getProducts({ limit: 5, sort: "latest" }),
    queryKey: queryKeys.products({ limit: 5, sort: "latest" })
  });
  const isLoading =
    categoriesQuery.isLoading || brandsQuery.isLoading || productsQuery.isLoading;
  const firstError =
    categoriesQuery.error ?? brandsQuery.error ?? productsQuery.error ?? null;

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={96}
        contentContainerStyle={{ paddingBottom: 24 }}
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
          <FeaturedCategoryRails categories={sortCategories(categoriesQuery.data).slice(0, 8)} />
        ) : null}
        {brandsQuery.data ? <BrandRail brands={brandsQuery.data} /> : null}
        {productsQuery.data?.items.length ? (
          <ProductRail products={productsQuery.data.items} title="Latest additions" />
        ) : null}
        <TrustRail />
        <View onLayout={(event) => setBulkOffset(event.nativeEvent.layout.y)}>
          <BulkQuoteSection />
        </View>
      </KeyboardAwareScrollView>
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
        paddingTop: 16,
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
    <View style={{ gap: 12, paddingTop: 32 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader title="Shop by Category" />
      </View>
      <FlatList
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
        data={sortCategories(categories).filter((category) => category.isActive).slice(0, 10)}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={({ index, item }) => (
          <Link
            asChild
            href={{
              pathname: "/search",
              params: { category: item.slug }
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
                  borderColor: "#B8E3DE",
                  borderCurve: "continuous",
                  borderRadius: 999,
                  borderWidth: 1,
                  alignItems: "center",
                  alignSelf: "stretch",
                  justifyContent: "center",
                  minHeight: 24,
                  paddingHorizontal: 10,
                  paddingVertical: 4
                }}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  numberOfLines={1}
                  selectable
                  style={{
                    color: colors.primaryDark,
                    flexShrink: 1,
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
              borderColor: "#9FD7D1",
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
      queryFn: () => getProducts({ category: category.slug, limit: 5 }),
      queryKey: queryKeys.products({ category: category.slug, limit: 5 })
    }))
  });

  const populatedCategories = categories
    .map((category, index) => ({
      category,
      products: queries[index]?.data?.items ?? []
    }))
    .filter(({ products }) => products.length >= 5)
    .slice(0, 5);

  if (populatedCategories.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 32, paddingTop: 32 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader
          actionHref="/search"
          actionText="View all"
          title="Featured products by category"
        />
      </View>
      {populatedCategories.map(({ category, products }) => (
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
                  params: { category: category.slug }
                }}
              >
                <Pressable
                  style={{
                    alignItems: "center",
                    backgroundColor: colors.surface,
                    borderColor: "#B8E3DE",
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
      ))}
    </View>
  );
}

function BrandRail({
  brands
}: {
  brands: Awaited<ReturnType<typeof getBrands>>;
}) {
  return (
    <View style={{ gap: 12, paddingTop: 32 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeader
          actionHref={"/brands" as Href}
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
    <View style={{ gap: 12, paddingTop: 32 }}>
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
    ["truck-fast-outline", "Delivery clarity", "Shown at checkout"],
    ["clipboard-check-outline", "Bulk quotes", "Tailored support"]
  ] as const;

  return (
    <View style={{ gap: 12, paddingHorizontal: 16, paddingTop: 32 }}>
      <SectionHeader title="Procurement support" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {items.map((item) => (
          <View
            key={item[1]}
            style={{
              ...cardStyle,
              flexBasis: "47%",
              flexGrow: 1,
              gap: 12,
              minHeight: 112,
              padding: 12
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: "#FFF3E3",
                borderRadius: 8,
                height: 40,
                justifyContent: "center",
                width: 40
              }}
            >
              <MaterialCommunityIcons color="#D26812" name={item[0]} size={21} />
            </View>
            <View style={{ gap: 4 }}>
              <Text
                selectable
                style={{
                  color: colors.text,
                  fontFamily: fonts.heading,
                  fontSize: 14,
                  lineHeight: 20
                }}
              >
                {item[1]}
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
                {item[2]}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function BulkQuoteSection() {
  const queryClient = useQueryClient();
  const submittingRef = useRef(false);
  const [form, setForm] = useState<QuoteRequestInput>(emptyQuoteForm);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof QuoteRequestInput, string>>
  >({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const quoteMutation = useMutation({
    mutationFn: createQuoteRequest,
    onSuccess: async (request) => {
      setForm(emptyQuoteForm);
      setFieldErrors({});
      setSuccessMessage(`Quote request ${request.id} received.`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.quotes });
    },
    onSettled: () => {
      submittingRef.current = false;
    }
  });

  function updateForm<Field extends keyof QuoteRequestInput>(
    field: Field,
    value: QuoteRequestInput[Field]
  ) {
    if (submittingRef.current) return;
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function submitQuote() {
    if (submittingRef.current || quoteMutation.isPending) return;
    const parsed = quoteRequestInputSchema.safeParse({
      ...form,
      organization: form.organization?.trim() || null
    });

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: errors.email?.[0],
        message: errors.message?.[0],
        mobileNumber: errors.mobileNumber?.[0],
        name: errors.name?.[0],
        organization: errors.organization?.[0]
      });
      return;
    }

    setFieldErrors({});
    setSuccessMessage(null);
    submittingRef.current = true;
    quoteMutation.mutate(parsed.data);
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 32 }}>
      <View
        style={{
          backgroundColor: "#14776F",
          borderRadius: 16,
          boxShadow: "0 10px 24px rgba(15, 111, 104, 0.15)",
          gap: 12,
          padding: 20
        }}
      >
        <Text
          selectable
          style={{
            color: "#B8E3DE",
            fontFamily: fonts.headingBold,
            fontSize: 12,
            letterSpacing: 1.7,
            textTransform: "uppercase"
          }}
        >
          Bulk procurement
        </Text>
        <Text
          selectable
          style={{
            color: colors.surface,
            fontFamily: fonts.heading,
            fontSize: 18,
            lineHeight: 24
          }}
        >
          Request a tailored quote
        </Text>
        <Text
          selectable
          style={{
            color: "rgba(255,255,255,0.75)",
            fontFamily: fonts.body,
            fontSize: 14,
            lineHeight: 24
          }}
        >
          Share items, quantities, and delivery details. Our team will follow up with the right options.
        </Text>
        <View style={{ gap: 12, paddingTop: 8 }}>
          <QuoteInput
            editable={!quoteMutation.isPending}
            error={fieldErrors.name}
            onChangeText={(value) => updateForm("name", value)}
            placeholder="Name"
            value={form.name}
          />
          <QuoteInput
            editable={!quoteMutation.isPending}
            error={fieldErrors.organization}
            onChangeText={(value) => updateForm("organization", value)}
            placeholder="Clinic or hospital"
            value={form.organization ?? ""}
          />
          <QuoteInput
            editable={!quoteMutation.isPending}
            autoCapitalize="none"
            error={fieldErrors.email}
            keyboardType="email-address"
            onChangeText={(value) => updateForm("email", value)}
            placeholder="Email"
            value={form.email}
          />
          <QuoteInput
            editable={!quoteMutation.isPending}
            error={fieldErrors.mobileNumber}
            keyboardType="phone-pad"
            onChangeText={(value) => updateForm("mobileNumber", value)}
            placeholder="Mobile number"
            value={form.mobileNumber}
          />
          <QuoteInput
            editable={!quoteMutation.isPending}
            error={fieldErrors.message}
            multiline
            onChangeText={(value) => updateForm("message", value)}
            placeholder="SKUs, quantities, city, and delivery timeline"
            style={{ borderRadius: 8, minHeight: 112, paddingTop: 13, textAlignVertical: "top" }}
            value={form.message}
          />
          {quoteMutation.isError ? (
            <Text
              accessibilityRole="alert"
              selectable
              style={quoteMessageStyle(colors.danger)}
            >
              {getErrorMessage(quoteMutation.error, "Unable to submit quote request.")}
            </Text>
          ) : null}
          {successMessage ? (
            <Text selectable style={quoteMessageStyle(colors.primaryDark)}>
              {successMessage}
            </Text>
          ) : null}
          <Button
            loading={quoteMutation.isPending}
            onPress={submitQuote}
            style={{ alignSelf: "stretch", backgroundColor: colors.surface }}
            variant="outline"
          >
            Request bulk quote
          </Button>
        </View>
      </View>
    </View>
  );
}

function QuoteInput({
  error,
  style,
  ...props
}: ComponentProps<typeof TextInput> & { error?: string }) {
  return (
    <View style={{ gap: 5 }}>
      <TextInput
        accessibilityHint={error}
        placeholderTextColor={colors.muted}
        style={[
          {
            backgroundColor: colors.surface,
            borderColor: error ? "#F4C7C3" : "rgba(255,255,255,0.25)",
            borderRadius: 999,
            borderWidth: 1,
            color: colors.text,
            fontFamily: fonts.bodySemiBold,
            fontSize: 14,
            minHeight: 48,
            paddingHorizontal: 16
          },
          style
        ]}
        {...props}
      />
      {error ? (
        <Text selectable style={{ color: colors.surface, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function quoteMessageStyle(color: string) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 8,
    color,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 20,
    padding: 12
  } as const;
}

function sortCategories(categories: Category[]) {
  return [...categories].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name);
  });
}
