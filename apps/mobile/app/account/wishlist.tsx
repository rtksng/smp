import { useEffect } from "react";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { AccountPageHeader } from "@/components/account-layout";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-view";
import { getWishlist, removeWishlistItem } from "@/lib/api/wishlist";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

export default function WishlistScreen() {
  const { isReady, session } = useAuth();
  const queryClient = useQueryClient();
  const wishlistQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getWishlist,
    queryKey: queryKeys.wishlist
  });
  const removeMutation = useMutation({
    mutationFn: removeWishlistItem,
    onSuccess: (wishlist) => queryClient.setQueryData(queryKeys.wishlist, wishlist)
  });

  useEffect(() => {
    if (isReady && !session) router.replace("/login?returnTo=/account/wishlist");
  }, [isReady, session]);

  if (!isReady || (session && wishlistQuery.isLoading)) {
    return <Screen><LoadingState label="Loading wishlist" /></Screen>;
  }
  if (!session) return null;
  if (wishlistQuery.isError || !wishlistQuery.data) {
    return <Screen><ErrorState message={getErrorMessage(wishlistQuery.error, "Unable to load your wishlist.")} onRetry={() => wishlistQuery.refetch()} /></Screen>;
  }

  const products = wishlistQuery.data.items;
  return (
    <Screen contentContainerStyle={{ gap: 20, paddingTop: 24 }}>
      <AccountPageHeader description="Review saved products and move back into the catalog when ready." title="Wishlist" />
      {removeMutation.isError ? <ErrorState message={getErrorMessage(removeMutation.error, "Unable to remove this product.")} /> : null}
      {products.length === 0 ? (
        <EmptyState action={<Button href="/search">Browse products</Button>} description="Products saved from the catalog will appear here." title="Your wishlist is empty" />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {products.map((product) => (
            <View key={product.id} style={{ gap: 8, width: "48%" }}>
              <ProductCard compact product={product} />
              <Pressable
                accessibilityLabel={`Remove ${product.name} from wishlist`}
                accessibilityRole="button"
                disabled={removeMutation.isPending}
                onPress={() => removeMutation.mutate(product.id)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  borderColor: colors.border,
                  borderRadius: 8,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 7,
                  justifyContent: "center",
                  minHeight: 38,
                  opacity: pressed ? 0.72 : 1
                })}
              >
                <Feather color={colors.danger} name="trash-2" size={14} />
                <Text style={{ color: colors.danger, fontFamily: fonts.bodySemiBold, fontSize: 12 }}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
