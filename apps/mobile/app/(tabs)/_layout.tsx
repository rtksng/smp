import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useState } from "react";
import { Pressable, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CatalogNavSheets,
  type CatalogSheet
} from "@/components/catalog-nav-sheets";
import { colors, fonts } from "@/lib/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [activeSheet, setActiveSheet] = useState<CatalogSheet>(null);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.text,
          tabBarItemStyle: {
            minHeight: 56,
            paddingVertical: 2
          },
          tabBarLabelStyle: {
            fontFamily: fonts.bodySemiBold,
            fontSize: 10
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            boxShadow: "0 -10px 25px rgba(40, 124, 48, 0.12)",
            height: 62 + insets.bottom,
            overflow: "hidden",
            paddingBottom: Math.max(insets.bottom, 6),
            paddingHorizontal: 12,
            paddingTop: 6
          }
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color }) => (
              <TabIcon color={color} name="home" />
            ),
            title: "Home"
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            tabBarButton: ({
              accessibilityLabel,
              accessibilityState,
              children,
              onLongPress,
              style,
              testID
            }) => (
              <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={accessibilityState}
                onLongPress={onLongPress}
                onPress={() => setActiveSheet("search")}
                style={style}
                testID={testID}
              >
                {children}
              </Pressable>
            ),
            tabBarIcon: () => (
              <TabIcon
                active={activeSheet === "search"}
                color={colors.text}
                name="search"
              />
            ),
            title: "Search"
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            tabBarButton: ({
              accessibilityLabel,
              accessibilityState,
              children,
              onLongPress,
              style,
              testID
            }) => (
              <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={accessibilityState}
                onLongPress={onLongPress}
                onPress={() => setActiveSheet("categories")}
                style={style}
                testID={testID}
              >
                {children}
              </Pressable>
            ),
            tabBarIcon: () => (
              <TabIcon
                active={activeSheet === "categories"}
                color={colors.text}
                name="grid"
              />
            ),
            title: "Categories"
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            tabBarIcon: ({ color }) => (
              <TabIcon color={color} name="user" />
            ),
            title: "Profile"
          }}
        />
      </Tabs>
      <CatalogNavSheets
        activeSheet={activeSheet}
        onClose={() => setActiveSheet(null)}
      />
    </>
  );
}

function TabIcon({
  active = false,
  color,
  name
}: {
  active?: boolean;
  color: ColorValue;
  name: "grid" | "home" | "search" | "user";
}) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: active ? colors.primaryDark : "transparent",
        borderRadius: 18,
        height: 36,
        justifyContent: "center",
        width: 36
      }}
    >
      <Feather
        color={active ? colors.surface : color}
        name={name}
        size={18}
      />
    </View>
  );
}
