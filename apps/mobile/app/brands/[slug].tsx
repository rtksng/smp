import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { View } from "react-native";
import { ProductListingScreen } from "../(tabs)/search";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-view";
import { getBrands } from "@/lib/api/catalog";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { colors } from "@/lib/theme";

export default function BrandProductsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const brandsQuery = useQuery({ queryFn: getBrands, queryKey: queryKeys.brands });
  const brand = brandsQuery.data?.find((item) => item.slug === slug);

  if (brandsQuery.isLoading) {
    return <StateContainer><LoadingState label="Loading brand products" /></StateContainer>;
  }

  if (brandsQuery.isError) {
    return <StateContainer><ErrorState message={getErrorMessage(brandsQuery.error, "Unable to load brand products.")} onRetry={() => void brandsQuery.refetch()} title="Unable to load brand products" /></StateContainer>;
  }

  if (!brand) {
    return <StateContainer><EmptyState description="This brand is not available in the customer catalog." title="Brand not found" /></StateContainer>;
  }

  return <ProductListingScreen brand={brand.slug} />;
}

function StateContainer({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: colors.background, flex: 1, padding: 16 }}>{children}</View>;
}
