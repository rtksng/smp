import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-view";
import { StoreFooter } from "@/components/store-footer";
import { getCategories } from "@/lib/api/catalog";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

export default function CategoriesScreen() {
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 2 : 1;
  const query = useQuery({
    queryFn: getCategories,
    queryKey: queryKeys.categories
  });

  return (
    <View style={{ backgroundColor: colors.background, flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          gap: 4,
          paddingBottom: 16,
          paddingHorizontal: 16,
          paddingTop: 12
        }}
      >
        <Text
          selectable
          style={{
            color: colors.ink,
            fontFamily: fonts.headingBold,
            fontSize: 20
          }}
        >
          Browse categories
        </Text>
      </View>
      {query.isLoading ? (
        <View style={{ padding: 16 }}>
          <LoadingState label="Loading categories" />
        </View>
      ) : null}
      {query.isError ? (
        <View style={{ padding: 16 }}>
          <ErrorState
            message={getErrorMessage(query.error, "Unable to load categories.")}
            onRetry={() => void query.refetch()}
          />
        </View>
      ) : null}
      {query.data ? (
        <FlatList
          contentContainerStyle={{
            alignSelf: "center",
            gap: 8,
            maxWidth: 980,
            paddingHorizontal: 16,
            paddingTop: 16,
            width: "100%"
          }}
          contentInsetAdjustmentBehavior="automatic"
          data={query.data
            .filter((category) => category.isActive)
            .sort((left, right) => left.sortOrder - right.sortOrder)}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={
            <EmptyState
              title="No categories found"
              description="Active catalog categories will appear here."
            />
          }
          ListFooterComponent={
            <View style={{ marginHorizontal: -16, marginTop: 32 }}>
              <StoreFooter />
            </View>
          }
          columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
          key={columns}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          renderItem={({ item }) => (
            <Link
              asChild
              href={{
                pathname: "/search",
                params: { category: item.slug }
              }}
            >
              <Pressable
                accessibilityRole="link"
                style={{
                  alignItems: "center",
                  backgroundColor: "#F7FCFB",
                  borderColor: colors.border,
                  borderRadius: 12,
                  borderWidth: 1,
                  flex: 1,
                  flexDirection: "row",
                  gap: 12,
                  minHeight: 56,
                  paddingHorizontal: 16,
                  paddingVertical: 12
                }}
              >
                <Text
                  numberOfLines={1}
                  selectable
                  style={{
                    color: colors.text,
                    flex: 1,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 14
                  }}
                >
                  {item.name}
                </Text>
                <MaterialCommunityIcons
                  color={colors.primaryDark}
                  name="chevron-right"
                  size={16}
                />
              </Pressable>
            </Link>
          )}
        />
      ) : null}
    </View>
  );
}
