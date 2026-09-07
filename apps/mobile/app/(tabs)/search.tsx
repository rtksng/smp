import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import {
  CatalogFilterSheet,
  defaultCatalogFilters,
  readPrice,
  type CatalogFilters
} from "@/components/catalog-filter-sheet";
import { ProductCard } from "@/components/product-card";
import { StoreFooter } from "@/components/store-footer";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/api/schemas";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-view";
import { getBrands, getCategories, getProducts } from "@/lib/api/catalog";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

export default function SearchScreen() {
  return <ProductListingScreen />;
}

export function ProductListingScreen({
  brand: brandOverride
}: {
  brand?: string;
} = {}) {
  const params = useLocalSearchParams<{
    brand?: string;
    category?: string;
    q?: string;
    subcategory?: string;
  }>();
  const activeBrand = brandOverride ?? params.brand;
  const [filters, setFilters] = useState<CatalogFilters>({
    ...defaultCatalogFilters,
    brand: activeBrand,
    category: params.category,
    search: params.q ?? "",
    subcategory: params.subcategory
  });
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList<Product>>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 4 : width >= 620 ? 3 : 2;
  const productWidth = (Math.min(width, 1100) - 32 - 12 * (columns - 1)) / columns;
  const query = {
    brand: brandOverride ?? filters.brand,
    category: filters.category,
    disposable: filters.disposable || undefined,
    expirySensitive: filters.expirySensitive || undefined,
    inStock: filters.availability
      ? true
      : filters.stock === "in_stock"
        ? true
        : filters.stock === "out_of_stock"
          ? false
          : undefined,
    limit: 12,
    page,
    maxPrice: readPrice(filters.maxPrice),
    medicalSpecialty: filters.medicalSpecialty.trim() || undefined,
    minPrice: readPrice(filters.minPrice),
    search: filters.search.trim() || undefined,
    sort: filters.sort,
    sterile: filters.sterile || undefined,
    subcategory: filters.subcategory
  };
  const productsQuery = useQuery({
    queryFn: () => getProducts(query),
    queryKey: queryKeys.products(query)
  });
  const categoriesQuery = useQuery({
    queryFn: getCategories,
    queryKey: queryKeys.categories
  });
  const brandsQuery = useQuery({
    queryFn: getBrands,
    queryKey: queryKeys.brands
  });

  useEffect(() => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      brand: activeBrand,
      category: params.category,
      search: params.q ?? "",
      subcategory: params.subcategory
    }));
  }, [activeBrand, params.category, params.q, params.subcategory]);

  function applyFilters(nextFilters: CatalogFilters) {
    setFilters({ ...nextFilters, brand: brandOverride ?? nextFilters.brand });
    setPage(1);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  const mainCategories = useMemo(
    () =>
      (categoriesQuery.data ?? [])
        .filter((category) => category.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [categoriesQuery.data]
  );
  const activeFilterLabels = [
    filters.search.trim() ? `Search: ${filters.search.trim()}` : null,
    filters.category ? `Category: ${filters.category}` : null,
    filters.subcategory ? `Subcategory: ${filters.subcategory}` : null,
    !brandOverride && filters.brand ? `Brand: ${filters.brand}` : null,
    filters.minPrice ? `Min Rs ${filters.minPrice}` : null,
    filters.maxPrice ? `Max Rs ${filters.maxPrice}` : null,
    filters.stock === "in_stock"
      ? "In stock"
      : filters.stock === "out_of_stock"
        ? "Out of stock"
        : null,
    filters.availability ? "Available only" : null,
    filters.sterile ? "Sterile" : null,
    filters.disposable ? "Disposable" : null,
    filters.expirySensitive ? "Expiry sensitive" : null,
    filters.medicalSpecialty ? `Specialty: ${filters.medicalSpecialty}` : null,
    filters.sort !== "latest"
      ? `Sort: ${filters.sort === "name_az" ? "Name A-Z" : filters.sort === "price_low_to_high" ? "Price low to high" : "Price high to low"}`
      : null
  ].filter((label): label is string => Boolean(label));

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          paddingBottom: 8,
          paddingHorizontal: 16,
          paddingTop: 8
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <CatalogControl
            accessibilityLabel="Open filters"
            onPress={() => setFiltersOpen(true)}
          />
          {mainCategories.length > 0 ? (
            <ScrollView
              accessibilityLabel="Main product categories"
              contentContainerStyle={{
                alignItems: "center",
                gap: 8,
                paddingRight: 4,
                paddingVertical: 4
              }}
              horizontal
              showsHorizontalScrollIndicator
              style={{ flex: 1 }}
            >
              {mainCategories.map((category) => {
                const selected = filters.category === category.slug;

                return (
                  <Pressable
                    accessibilityLabel={category.name}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={category.id}
                    onPress={() =>
                      applyFilters({
                        ...filters,
                        category: category.slug,
                        subcategory: undefined
                      })
                    }
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: selected ? colors.primaryDark : colors.surface,
                      borderColor: selected ? colors.primaryDark : colors.border,
                      borderRadius: 999,
                      borderWidth: 1,
                      justifyContent: "center",
                      opacity: pressed ? 0.78 : 1,
                      paddingHorizontal: 12,
                      paddingVertical: 6
                    })}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: selected ? colors.surface : colors.text,
                        fontFamily: fonts.bodyMedium,
                        fontSize: 12,
                        lineHeight: 16
                      }}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      </View>

      {activeFilterLabels.length > 0 ? (
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            paddingHorizontal: 16,
            paddingTop: 10
          }}
        >
          <Text
            style={{
              color: colors.primaryDark,
              fontFamily: fonts.bodySemiBold,
              fontSize: 10,
              textTransform: "uppercase"
            }}
          >
            Active filters
          </Text>
          {activeFilterLabels.map((label) => (
            <Text
              key={label}
              style={{
                backgroundColor: "#F8FBFA",
                borderColor: colors.border,
                borderRadius: 999,
                borderWidth: 1,
                color: colors.text,
                fontFamily: fonts.bodySemiBold,
                fontSize: 10,
                paddingHorizontal: 8,
                paddingVertical: 4
              }}
            >
              {label}
            </Text>
          ))}
          <Pressable
            accessibilityLabel="Clear active filters"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() =>
              applyFilters({ ...defaultCatalogFilters, brand: brandOverride })
            }
            style={{ minHeight: 32, justifyContent: "center" }}
          >
            <Text
              style={{
                color: colors.primaryDark,
                fontFamily: fonts.bodySemiBold,
                fontSize: 10
              }}
            >
              Clear
            </Text>
          </Pressable>
        </View>
      ) : null}

      {productsQuery.isLoading ? (
        <View style={{ padding: 16 }}>
          <LoadingState label="Finding products" />
        </View>
      ) : null}
      {productsQuery.isError ? (
        <View style={{ padding: 16 }}>
          <ErrorState
            message={getErrorMessage(productsQuery.error, "Unable to load products.")}
            onRetry={() => void productsQuery.refetch()}
            title="Unable to load products"
          />
        </View>
      ) : null}
      {productsQuery.data?.items.length === 0 ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            description="Try a broader product name, SKU, or another filter."
            title="No products found"
          />
        </View>
      ) : null}
      {productsQuery.data?.items.length ? (
        <FlatList
          ref={listRef}
          contentContainerStyle={{
            alignSelf: "center",
            gap: 12,
            maxWidth: 1100,
            paddingHorizontal: 16,
            paddingTop: 16,
            width: "100%"
          }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={
            process.env.EXPO_OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          data={productsQuery.data.items}
          refreshing={productsQuery.isRefetching}
          onRefresh={() => void productsQuery.refetch()}
          key={columns}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={{ alignItems: "flex-start", gap: 12 }}
          ListFooterComponent={
            <View>
              {productsQuery.data.pagination.totalPages > 1 ? (
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: 8,
                    justifyContent: "space-between",
                    paddingVertical: 12
                  }}
                >
                  <Button
                    disabled={page <= 1 || productsQuery.isFetching}
                    onPress={() => changePage(page - 1)}
                    variant="outline"
                    style={{ paddingHorizontal: 14 }}
                  >
                    Previous
                  </Button>
                  <Text
                    selectable
                    style={{
                      color: colors.muted,
                      fontFamily: fonts.bodySemiBold,
                      fontSize: 12
                    }}
                  >
                    Page {page} of {productsQuery.data.pagination.totalPages}
                  </Text>
                  <Button
                    disabled={
                      !productsQuery.data.pagination.hasNextPage ||
                      productsQuery.isFetching
                    }
                    onPress={() => changePage(page + 1)}
                    variant="outline"
                    style={{ paddingHorizontal: 14 }}
                  >
                    Next
                  </Button>
                </View>
              ) : null}
              <View style={{ marginHorizontal: -16, marginTop: 32 }}>
                <StoreFooter />
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ width: productWidth }}>
              <ProductCard compact product={item} />
            </View>
          )}
        />
      ) : null}
      {!productsQuery.isLoading && !productsQuery.data?.items.length ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingTop: 32 }}
        >
          <StoreFooter />
        </ScrollView>
      ) : null}
      <CatalogFilterSheet
        brands={brandsQuery.data?.filter((brand) => brand.isActive) ?? []}
        categories={categoriesQuery.data?.filter((category) => category.isActive) ?? []}
        filters={filters}
        lockedBrand={brandOverride}
        onApply={(nextFilters) => {
          applyFilters(nextFilters);
          setFiltersOpen(false);
        }}
        onClose={() => setFiltersOpen(false)}
        visible={filtersOpen}
      />
    </View>
  );
}

function CatalogControl({
  accessibilityLabel,
  onPress
}: {
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        height: 44,
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
        width: 44
      })}
    >
      <MaterialCommunityIcons
        color={colors.primaryDark}
        name="tune-variant"
        size={20}
      />
    </Pressable>
  );
}
