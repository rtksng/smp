import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
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

  function clearFilters() {
    setFilters({
      ...defaultCatalogFilters,
      brand: brandOverride,
      category: brandOverride ? undefined : params.category
    });
  }

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          paddingBottom: 12,
          paddingHorizontal: 16,
          paddingTop: 12
        }}
      >
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <Pressable
            accessibilityLabel="Show in-stock products"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: filters.availability }}
            onPress={() =>
              setFilters((current) => ({
                ...current,
                availability: !current.availability
              }))
            }
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: colors.primaryDark,
              borderRadius: 999,
              flex: 1,
              justifyContent: "center",
              minHeight: 44,
              opacity: pressed ? 0.82 : 1,
              paddingHorizontal: 16
            })}
          >
            <Text
              style={{
                color: colors.surface,
                fontFamily: fonts.bodySemiBold,
                fontSize: 12
              }}
            >
              {filters.availability ? "Showing in stock" : "In-stock only"}
            </Text>
          </Pressable>
          <CatalogControl
            accessibilityLabel="Open filters"
            icon="tune-variant"
            onPress={() => setFiltersOpen(true)}
          />
          <CatalogControl
            accessibilityLabel="Clear catalog filters"
            icon="restore"
            onPress={clearFilters}
          />
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
  icon,
  onPress
}: {
  accessibilityLabel: string;
  icon: "restore" | "tune-variant";
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
      <MaterialCommunityIcons color={colors.text} name={icon} size={20} />
    </Pressable>
  );
}
