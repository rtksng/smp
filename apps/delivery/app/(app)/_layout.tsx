import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../lib/auth/auth-context";

export default function AppLayout() {
  const { isReady, session } = useAuth();

  if (isReady && !session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#F8FAFC" },
        headerTitleStyle: {
          color: "#0F172A",
          fontSize: 18,
          fontWeight: "800"
        },
        sceneStyle: { backgroundColor: "#F8FAFC" },
        tabBarActiveTintColor: "#287C30",
        tabBarInactiveTintColor: "#64748B",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800" },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E2E8F0",
          height: 66,
          paddingBottom: 7,
          paddingTop: 5
        }
      }}
    >
      <Tabs.Screen
        name="assignments"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="cube-outline" size={size} />
          ),
          title: "Deliveries"
        }}
      />
      <Tabs.Screen
        name="cash"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="wallet-outline" size={size} />
          ),
          title: "Cash & Earnings"
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="person-circle-outline" size={size} />
          ),
          title: "Profile"
        }}
      />
      {[
        ["assignments/[id]", "Delivery"],
        ["documents", "Documents"],
        ["edit-profile", "Edit profile"],
        ["notifications", "Notifications"],
        ["settings", "Permissions & settings"],
        ["support", "Help & incidents"],
        ["sync", "Offline sync"]
      ].map(([name, title]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            href: null,
            tabBarStyle: { display: "none" },
            title
          }}
        />
      ))}
    </Tabs>
  );
}
