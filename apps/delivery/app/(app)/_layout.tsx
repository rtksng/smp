import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../lib/auth/auth-context";

export default function AppLayout() {
  const { isReady, session } = useAuth();

  if (isReady && !session) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "#F8FAFC" },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#F8FAFC" },
        headerTitleStyle: {
          color: "#0F172A",
          fontSize: 18,
          fontWeight: "800"
        }
      }}
    >
      <Stack.Screen name="assignments" options={{ title: "Deliveries" }} />
      <Stack.Screen name="assignments/[id]" options={{ title: "Delivery" }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
    </Stack>
  );
}
