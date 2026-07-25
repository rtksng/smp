import "react-native-gesture-handler";
import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat/700Bold";
import { OpenSans_400Regular } from "@expo-google-fonts/open-sans/400Regular";
import { OpenSans_600SemiBold } from "@expo-google-fonts/open-sans/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager
} from "@tanstack/react-query";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth/auth-context";
import { colors, fonts } from "@/lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: 0
    },
    queries: {
      retry: 1,
      staleTime: 60_000
    }
  }
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    OpenSans_400Regular,
    OpenSans_600SemiBold
  });

  useEffect(() => {
    return onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) =>
        setOnline(Boolean(state.isConnected && state.isInternetReachable !== false))
      )
    );
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: colors.background },
                headerBackButtonDisplayMode: "minimal",
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.surface },
                headerTitleStyle: {
                  color: colors.ink,
                  fontFamily: fonts.heading,
                  fontSize: 17
                }
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="login"
                options={{
                  presentation:
                    process.env.EXPO_OS === "ios" ? "formSheet" : "modal",
                  sheetAllowedDetents: [0.82, 1],
                  sheetGrabberVisible: true,
                  sheetInitialDetentIndex: 1,
                  title: "Login / Signup"
                }}
              />
              <Stack.Screen name="products/[slug]" options={{ title: "Product" }} />
              <Stack.Screen name="cart" options={{ title: "Your cart" }} />
              <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
              <Stack.Screen
                name="addresses/index"
                options={{ title: "Saved addresses" }}
              />
              <Stack.Screen
                name="addresses/form"
                options={{
                  presentation:
                    process.env.EXPO_OS === "ios" ? "formSheet" : "modal",
                  sheetAllowedDetents: [0.9, 1],
                  sheetGrabberVisible: true,
                  sheetInitialDetentIndex: 1,
                  title: "Delivery address"
                }}
              />
              <Stack.Screen name="orders/index" options={{ title: "Your orders" }} />
              <Stack.Screen name="orders/[id]" options={{ title: "Order details" }} />
              <Stack.Screen
                name="order-success/[id]"
                options={{ headerBackVisible: false, title: "Order placed" }}
              />
              <Stack.Screen name="+not-found" options={{ title: "Not found" }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
