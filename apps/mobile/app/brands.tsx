import { useMemo, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-view";
import { getBrands, getProducts } from "@/lib/api/catalog";
import type { Brand, ProductList } from "@/lib/api/schemas";
import { getErrorMessage } from "@/lib/errors";
import { formatCatalogRupees } from "@/lib/format";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

type LogoFilter = "all" | "with-logo" | "without-logo";

export default function BrandsScreen() {
  const [query, setQuery] = useState("");
  const [logoFilter, setLogoFilter] = useState<LogoFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const brandsQuery = useQuery({ queryFn: getBrands, queryKey: queryKeys.brands });
  const activeBrands = useMemo(() => (brandsQuery.data ?? []).filter((brand) => brand.isActive), [brandsQuery.data]);
  const previewQueries = useQueries({
    queries: activeBrands.map((brand) => ({
      queryFn: () => getProducts({ brand: brand.slug, limit: 5, sort: "latest" as const }),
      queryKey: queryKeys.products({ brand: brand.slug, limit: 5, sort: "latest" })
    }))
  });
  const previews = Object.fromEntries(activeBrands.map((brand, index) => [brand.slug, previewQueries[index]?.data]));
  const filteredBrands = activeBrands.filter((brand) => {
    const needle = query.trim().toLowerCase();
    const matchesText = !needle || `${brand.name} ${brand.slug} ${brand.description ?? ""}`.toLowerCase().includes(needle);
    const matchesLogo = logoFilter === "all" || (logoFilter === "with-logo" ? Boolean(brand.logoUrl) : !brand.logoUrl);
    return matchesText && matchesLogo;
  });

  return (
    <Screen contentContainerStyle={{ gap: 28 }}>
      {brandsQuery.isLoading ? <LoadingState label="Loading brands" /> : null}
      {brandsQuery.isError ? <ErrorState message={getErrorMessage(brandsQuery.error, "Brand catalog data is unavailable right now.")} onRetry={() => brandsQuery.refetch()} title="Unable to load brands" /> : null}
      {brandsQuery.isSuccess && activeBrands.length === 0 ? <EmptyState description="No active customer brands are available yet." title="No brands found" /> : null}

      {activeBrands.length > 0 ? (
        <>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 14, padding: 16 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Search brands</Text>
            <View style={{ alignItems: "center", borderColor: "#CBDEDB", borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 44, paddingHorizontal: 12 }}>
              <Feather color={colors.primaryDark} name="search" size={16} />
              <TextInput accessibilityLabel="Search brands" autoCapitalize="none" onChangeText={setQuery} placeholder="Search by brand, use case, or slug" placeholderTextColor={colors.muted} style={{ color: colors.text, flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14 }} value={query} />
            </View>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Feather color={colors.primaryDark} name="sliders" size={16} />
              <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Filter</Text>
            </View>
            <Pressable
              accessibilityLabel="Brand logo filter"
              accessibilityRole="button"
              onPress={() => setFilterOpen(true)}
              style={{ alignItems: "center", borderColor: "#CBDEDB", borderRadius: 8, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12 }}
            >
              <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{logoFilterLabel(logoFilter)}</Text>
              <Feather color={colors.text} name="chevron-down" size={18} />
            </Pressable>
          </View>
          <Modal animationType="fade" onRequestClose={() => setFilterOpen(false)} transparent visible={filterOpen}>
            <Pressable onPress={() => setFilterOpen(false)} style={{ backgroundColor: "rgba(7,59,56,0.35)", flex: 1, justifyContent: "center", padding: 24 }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 8, gap: 4, padding: 8 }}>
                {([['all', 'All brands'], ['with-logo', 'With logos'], ['without-logo', 'Without logos']] as const).map(([value, label]) => (
                  <Pressable
                    accessibilityRole="button"
                    key={value}
                    onPress={() => { setLogoFilter(value); setFilterOpen(false); }}
                    style={{ alignItems: "center", backgroundColor: logoFilter === value ? colors.primarySoft : colors.surface, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: 14 }}
                  >
                    <Text style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{label}</Text>
                    {logoFilter === value ? <Feather color={colors.primaryDark} name="check" size={18} /> : null}
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
          {filteredBrands.length === 0 ? <EmptyState description="No brands match the current filters." title="No brands found" /> : filteredBrands.map((brand) => <BrandCard brand={brand} key={brand.id} products={previews[brand.slug]} />)}
        </>
      ) : null}
    </Screen>
  );
}

function logoFilterLabel(filter: LogoFilter) {
  return filter === "with-logo" ? "With logos" : filter === "without-logo" ? "Without logos" : "All brands";
}

function BrandCard({ brand, products }: { brand: Brand; products?: ProductList }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 18, padding: 20 }}>
      <Pressable onPress={() => router.push(`/brands/${encodeURIComponent(brand.slug)}` as Href)} style={{ alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 112, padding: 16 }}>
        {brand.logoUrl ? <Image accessibilityLabel={`${brand.name} logo`} contentFit="contain" source={{ uri: brand.logoUrl }} style={{ height: 64, width: "82%" }} /> : <View style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: 32, height: 64, justifyContent: "center", width: 64 }}><Text style={{ color: colors.primaryDark, fontFamily: fonts.heading, fontSize: 20 }}>{brand.name.slice(0, 2).toUpperCase()}</Text></View>}
      </Pressable>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.heading, fontSize: 20, lineHeight: 28 }}>{brand.name}</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 24 }}>{brand.description ?? "Browse verified surgical and medical products from this brand."}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
          <Button href={`/brands/${encodeURIComponent(brand.slug)}` as Href}>Open products</Button>
          <Button href={{ pathname: "/search", params: { brand: brand.slug } }} variant="outline">Filter catalog</Button>
        </View>
      </View>
      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 9, paddingTop: 16 }}>
        <Text style={{ color: colors.primaryDark, fontFamily: fonts.heading, fontSize: 13, textTransform: "uppercase" }}>Latest brand products</Text>
        {!products ? <Text style={previewStyle}>Product preview is unavailable right now.</Text> : products.items.length === 0 ? <Text style={previewStyle}>No active products are listed for this brand yet.</Text> : products.items.slice(0, 4).map((product) => (
          <Pressable key={product.id} onPress={() => router.push({ pathname: "/products/[slug]", params: { slug: product.slug } })} style={({ pressed }) => ({ backgroundColor: pressed ? colors.primarySoft : "#F7FCFB", borderColor: colors.border, borderRadius: 8, borderWidth: 1, gap: 4, paddingHorizontal: 14, paddingVertical: 12 })}>
            <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>{product.name}</Text>
            <Text style={{ color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>{product.category.name} - {formatCatalogRupees(product.sellingPrice)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const previewStyle = { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderStyle: "dashed" as const, borderWidth: 1, color: colors.muted, fontFamily: fonts.bodySemiBold, fontSize: 13, padding: 12 };
