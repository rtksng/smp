import { Feather } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CatalogNavSheets,
  type CatalogSheet
} from "@/components/catalog-nav-sheets";
import { colors, fonts } from "@/lib/theme";

const navigationItems = [
  { href: "/" as const, icon: "home" as const, label: "Home" },
  { action: "search" as const, icon: "search" as const, label: "Search" },
  {
    action: "categories" as const,
    icon: "grid" as const,
    label: "Categories"
  },
  { href: "/account" as const, icon: "user" as const, label: "Profile" }
];

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [activeSheet, setActiveSheet] = useState<CatalogSheet>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const navigationVisible =
    activeSheet === null &&
    !keyboardVisible &&
    !pathname.startsWith("/products/");

  return (
    <>
      {navigationVisible ? (
        <View
          accessibilityLabel="Customer navigation"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            boxShadow: "0 -10px 25px rgba(40, 124, 48, 0.12)",
            flexDirection: "row",
            minHeight: 62 + insets.bottom,
            overflow: "hidden",
            paddingBottom: Math.max(insets.bottom, 6),
            paddingHorizontal: 12,
            paddingTop: 6
          }}
        >
          {navigationItems.map((item) => {
            const active = item.action ? activeSheet === item.action : false;

            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={item.label}
                onPress={() => {
                  if (item.action) {
                    setActiveSheet(item.action);
                    return;
                  }

                  router.push(item.href);
                }}
                style={({ pressed }) => ({
                  alignItems: "center",
                  flex: 1,
                  gap: 2,
                  justifyContent: "center",
                  minHeight: 56,
                  opacity: pressed ? 0.74 : 1,
                  paddingVertical: 2
                })}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: active
                      ? colors.primaryDark
                      : "transparent",
                    borderRadius: 18,
                    height: 36,
                    justifyContent: "center",
                    width: 36
                  }}
                >
                  <Feather
                    color={active ? colors.surface : colors.text}
                    name={item.icon}
                    size={18}
                  />
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontFamily: fonts.bodySemiBold,
                    fontSize: 10
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <CatalogNavSheets
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
      />
    </>
  );
}
