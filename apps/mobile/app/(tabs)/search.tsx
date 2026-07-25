import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/product-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-view";
import { getProducts, type ProductQuery } from "@/lib/api/catalog";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

export default function SearchScreen() {
  const params = useLocalSearchParams<{
    brand?: string;
    category?: string;
    q?: string;
    title?: string;
  }>();
  const [search, setSearch] = useState(params.q ?? "");
  const [submittedSearch, setSubmittedSearch] = useState(params.q ?? "");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<ProductQuery["sort"]>("latest");
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = width >= 900 ? 4 : width >= 620 ? 3 : 2;
  const query = {
    brand: params.brand,
    category: params.category,
    inStock: inStockOnly || undefined,
    limit: 40,
    search: submittedSearch.trim() || undefined,
    sort
  };
  const productsQuery = useQuery({
    queryFn: () => getProducts(query),
    queryKey: queryKeys.products(query)
  });

  useEffect(() => {
    setSearch(params.q ?? "");
    setSubmittedSearch(params.q ?? "");
  }, [params.q]);

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          gap: 10,
          paddingBottom: 16,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12
        }}
      >
        <Text
          selectable
          style={{
            color: colors.ink,
            fontFamily: fonts.headingBold,
            fontSize: 22
          }}
        >
          {params.title ?? "Search catalog"}
        </Text>
        <View
          style={{
            alignItems: "center",
            borderColor: colors.primaryDark,
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: "row",
            minHeight: 48,
            paddingHorizontal: 16
          }}
        >
          <TextInput
            accessibilityLabel="Search products or SKU"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearch}
            onSubmitEditing={() => setSubmittedSearch(search)}
            placeholder="Search products or SKU"
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={{
              color: colors.text,
              flex: 1,
              fontFamily: fonts.bodySemiBold,
              fontSize: 14
            }}
            value={search}
          />
          <Pressable
            accessibilityLabel="Search catalog"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setSubmittedSearch(search)}
            style={{
              alignItems: "center",
              height: 44,
              justifyContent: "center",
              width: 44
            }}
          >
            <MaterialCommunityIcons
              color={colors.primaryDark}
              name="magnify"
              size={22}
            />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <FilterChip
            active={inStockOnly}
            label="In stock"
            onPress={() => setInStockOnly((value) => !value)}
            role="checkbox"
          />
          <FilterChip
            active={sort === "latest"}
            label="Latest"
            onPress={() => setSort("latest")}
            role="radio"
          />
          <FilterChip
            active={sort === "price_low_to_high"}
            label="Price: low to high"
            onPress={() => setSort("price_low_to_high")}
            role="radio"
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
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <ProductCard product={item} />
            </View>
          )}
        />
      ) : null}
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
  role
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  role: "checkbox" | "radio";
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={{
        alignItems: "center",
        backgroundColor: active ? colors.primaryDark : colors.surfaceMuted,
        borderColor: active ? colors.primaryDark : colors.border,
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: "center",
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 8
      }}
    >
      <Text
        selectable
        style={{
          color: active ? colors.surface : colors.text,
          fontFamily: fonts.bodySemiBold,
          fontSize: 11
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
