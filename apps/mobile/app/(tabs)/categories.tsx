import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { ErrorState, LoadingState } from "@/components/ui/state-view";
import { getCategories } from "@/lib/api/catalog";
import { getErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query";
import { cardStyle, colors, fonts } from "@/lib/theme";

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
            fontSize: 22
          }}
        >
          Browse categories
        </Text>
        <Text
          selectable
          style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13 }}
        >
          Explore the same verified medical catalog by department.
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
            gap: 12,
            maxWidth: 980,
            padding: 16,
            width: "100%"
          }}
          contentInsetAdjustmentBehavior="automatic"
          data={query.data.filter((category) => category.isActive)}
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
                style={{
                  ...cardStyle,
                  alignItems: "center",
                  flex: 1,
                  flexDirection: "row",
                  gap: 14,
                  padding: 14
                }}
              >
                {item.imageUrl ? (
                  <Image
                    accessibilityLabel={item.name}
                    contentFit="cover"
                    source={{ uri: item.imageUrl }}
                    style={{ borderRadius: 10, height: 58, width: 58 }}
                  />
                ) : (
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: colors.primarySoft,
                      borderRadius: 10,
                      height: 58,
                      justifyContent: "center",
                      width: 58
                    }}
                  >
                    <MaterialCommunityIcons
                      color={colors.primaryDark}
                      name="medical-bag"
                      size={28}
                    />
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    selectable
                    style={{
                      color: colors.text,
                      fontFamily: fonts.heading,
                      fontSize: 16
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text
                    numberOfLines={2}
                    selectable
                    style={{
                      color: colors.muted,
                      fontFamily: fonts.body,
                      fontSize: 12,
                      lineHeight: 18
                    }}
                  >
                    {item.description ??
                      `${item.children.length} subcategories available`}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  color={colors.primaryDark}
                  name="chevron-right"
                  size={22}
                />
              </Pressable>
            </Link>
          )}
        />
      ) : null}
    </View>
  );
}
