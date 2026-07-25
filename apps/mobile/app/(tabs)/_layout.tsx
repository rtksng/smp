import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@/lib/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.text,
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
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 4
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              color={focused ? colors.surface : color}
              name="home-outline"
              size={20}
              style={{
                backgroundColor: focused ? colors.primaryDark : "transparent",
                borderRadius: 18,
                padding: 8
              }}
            />
          ),
          title: "Home"
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              color={focused ? colors.surface : color}
              name="magnify"
              size={20}
              style={{
                backgroundColor: focused ? colors.primaryDark : "transparent",
                borderRadius: 18,
                padding: 8
              }}
            />
          ),
          title: "Search"
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              color={focused ? colors.surface : color}
              name="view-grid-outline"
              size={20}
              style={{
                backgroundColor: focused ? colors.primaryDark : "transparent",
                borderRadius: 18,
                padding: 8
              }}
            />
          ),
          title: "Categories"
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              color={focused ? colors.surface : color}
              name="account-outline"
              size={20}
              style={{
                backgroundColor: focused ? colors.primaryDark : "transparent",
                borderRadius: 18,
                padding: 8
              }}
            />
          ),
          title: "Profile"
        }}
      />
    </Tabs>
  );
}
