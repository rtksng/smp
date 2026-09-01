import { useEffect, useMemo, useState } from "react";
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
  }>();
  const activeBrand = brandOverride ?? params.brand;
  const [filters, setFilters] = useState<CatalogFilters>({
    ...defaultCatalogFilters,
    brand: activeBrand,
    category: params.category,
    search: params.q ?? ""
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 4 : width >= 620 ? 3 : 2;
  const productWidth =
    (Math.min(width, 1100) - 32 - 12 * (columns - 1)) / columns;
  const query = {
    brand: filters.brand,
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
    limit: 40,
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
    setFilters((current) => ({
      ...current,
      brand: activeBrand,
      category: params.category,
      search: params.q ?? "",
      subcategory: undefined
    }));
  }, [activeBrand, params.category, params.q]);

  const mainCategories = useMemo(
    () =>
      (categoriesQuery.data ?? [])
        .filter((category) => category.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [categoriesQuery.data]
  );

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
                      setFilters((current) => ({
                        ...current,
                        category: category.slug,
                        subcategory: undefined
                      }))
                    }
                    style={({ pressed }) => ({
                      alignItems: "center",
                      backgroundColor: selected
                        ? colors.primaryDark
                        : colors.surface,
                      borderColor: selected
                        ? colors.primaryDark
                        : colors.border,
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

      {productsQuery.isLoading ? (
        <View style={{ padding: 16 }}>
          <LoadingState label="Finding products" />
        </View>
      ) : null}
      {productsQuery.isError ? (
        <View style={{ padding: 16 }}>
          <ErrorState
            message={getErrorMessage(
              productsQuery.error,
              "Unable to load products."
            )}
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
          contentContainerStyle={{
            alignSelf: "center",
            gap: 12,
            maxWidth: 1100,
            padding: 16,
            width: "100%"
          }}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={
            process.env.EXPO_OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          data={productsQuery.data.items}
          key={columns}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={{ alignItems: "flex-start", gap: 12 }}
          renderItem={({ item }) => (
            <View style={{ width: productWidth }}>
              <ProductCard compact product={item} />
            </View>
          )}
        />
      ) : null}
      <CatalogFilterSheet
        brands={brandsQuery.data?.filter((brand) => brand.isActive) ?? []}
        categories={
          categoriesQuery.data?.filter((category) => category.isActive) ?? []
        }
        filters={filters}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
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
