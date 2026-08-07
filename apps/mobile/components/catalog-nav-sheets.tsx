import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState, type RefObject } from "react";
import {
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCategories } from "@/lib/api/catalog";
import { queryKeys } from "@/lib/query";
import { colors, fonts } from "@/lib/theme";

export type CatalogSheet = "categories" | "search" | null;

export function CatalogNavSheets({
  activeSheet,
  onClose
}: {
  activeSheet: CatalogSheet;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<TextInput>(null);
  const categoriesQuery = useQuery({
    enabled: activeSheet !== null,
    queryFn: getCategories,
    queryKey: queryKeys.categories
  });
  const categories =
    categoriesQuery.data?.filter((category) => category.isActive) ?? [];

  return (
    <Modal
      animationType={activeSheet === "categories" ? "slide" : "fade"}
      onShow={() => {
        if (activeSheet === "search") {
          searchInputRef.current?.focus();
        }
      }}
      onRequestClose={() => {
        if (
          activeSheet === "search" &&
          (Keyboard.isVisible() || searchInputRef.current?.isFocused())
        ) {
          searchInputRef.current?.blur();
          Keyboard.dismiss();
          return;
        }

        onClose();
      }}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={activeSheet !== null}
    >
      {activeSheet === "categories" ? (
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityLabel="Close categories"
            accessibilityRole="button"
            onPress={onClose}
            style={{
              ...StyleSheetAbsoluteFill,
              backgroundColor: "rgba(15, 23, 42, 0.35)"
            }}
          />
          <View
            accessibilityLabel="Browse categories"
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.surface,
              borderCurve: "continuous",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "68%",
              paddingBottom: Math.max(insets.bottom, 12)
            }}
          >
            <SheetHeader label="Browse categories" onClose={onClose} />
            <FlatList
              contentContainerStyle={{
                gap: 8,
                paddingBottom: 8,
                paddingHorizontal: 16
              }}
              data={categories}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text
                  selectable
                  style={{
                    color: colors.muted,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 13,
                    paddingVertical: 20,
                    textAlign: "center"
                  }}
                >
                  {categoriesQuery.isLoading
                    ? "Loading categories..."
                    : "Categories are unavailable right now."}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    onClose();
                    router.push({
                      pathname: "/search",
                      params: { category: item.slug }
                    });
                  }}
                  style={({ pressed }) => ({
                    alignItems: "center",
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderCurve: "continuous",
                    borderRadius: 12,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 12,
                    minHeight: 56,
                    opacity: pressed ? 0.8 : 1,
                    paddingHorizontal: 16
                  })}
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
                  <Feather
                    color={colors.text}
                    name="chevron-right"
                    size={16}
                  />
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      ) : null}

      {activeSheet === "search" ? (
        <View
          style={{
            backgroundColor: colors.surface,
            flex: 1,
            paddingBottom: insets.bottom,
            paddingTop: insets.top
          }}
        >
          <SheetHeader label="Search catalog" onClose={onClose} />
          <SearchSheetContent
            categories={categories.slice(0, 6)}
            inputRef={searchInputRef}
            onClose={onClose}
          />
        </View>
      ) : null}
    </Modal>
  );
}

function SearchSheetContent({
  categories,
  inputRef,
  onClose
}: {
  categories: Array<{ id: string; name: string; slug: string }>;
  inputRef: RefObject<TextInput | null>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  function submitSearch() {
    const query = search.trim();
    onClose();
    router.push({
      pathname: "/search",
      params: query ? { q: query } : {}
    });
  }

  return (
    <View style={{ gap: 20, paddingBottom: 24, paddingHorizontal: 16 }}>
      <View style={{ gap: 8 }}>
        <Text
          selectable
          style={{
            color: colors.text,
            fontFamily: fonts.bodySemiBold,
            fontSize: 14
          }}
        >
          Search products or SKU
        </Text>
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            borderColor: colors.primaryDark,
            borderCurve: "continuous",
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
            onSubmitEditing={submitSearch}
            placeholder="Search catalog"
            placeholderTextColor={colors.muted}
            ref={inputRef}
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
            hitSlop={8}
            onPress={submitSearch}
            style={{
              alignItems: "center",
              height: 40,
              justifyContent: "center",
              width: 40
            }}
          >
            <Feather color={colors.text} name="search" size={16} />
          </Pressable>
        </View>
      </View>

      {categories.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text
            selectable
            style={{
              color: colors.muted,
              fontFamily: fonts.bodySemiBold,
              fontSize: 12,
              textTransform: "uppercase"
            }}
          >
            Browse categories
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map((category) => (
              <Pressable
                accessibilityRole="link"
                key={category.id}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: "/search",
                    params: { category: category.slug }
                  });
                }}
                style={({ pressed }) => ({
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                  borderCurve: "continuous",
                  borderRadius: 999,
                  borderWidth: 1,
                  minHeight: 36,
                  opacity: pressed ? 0.8 : 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8
                })}
              >
                <Text
                  selectable
                  style={{
                    color: colors.text,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 12
                  }}
                >
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SheetHeader({
  label,
  onClose
}: {
  label: string;
  onClose: () => void;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        justifyContent: "space-between",
        padding: 16
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
        {label}
      </Text>
      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => ({
          alignItems: "center",
          borderColor: colors.border,
          borderRadius: 999,
          borderWidth: 1,
          height: 40,
          justifyContent: "center",
          opacity: pressed ? 0.72 : 1,
          width: 40
        })}
      >
        <Feather color={colors.text} name="x" size={20} />
      </Pressable>
    </View>
  );
}

const StyleSheetAbsoluteFill = {
  bottom: 0,
  left: 0,
  position: "absolute" as const,
  right: 0,
  top: 0
};
