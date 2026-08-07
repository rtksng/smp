import "react-native-gesture-handler";
import { useEffect } from "react";
import NetInfo from "@react-native-community/netinfo";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager
} from "@tanstack/react-query";
import { AppState, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth/auth-context";
import { MobileBottomNavigation } from "@/components/mobile-bottom-navigation";
import { StoreHeader } from "@/components/store-header";
import { colors } from "@/lib/theme";

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
    Inter_400Regular,
    Inter_600SemiBold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold
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
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style="dark" />
              <View style={{ backgroundColor: colors.background, flex: 1 }}>
                <StoreHeader />
                <View style={{ flex: 1 }}>
                  <Stack
                    screenOptions={{
                      animation: "fade",
                      contentStyle: { backgroundColor: colors.background },
                      headerShown: false
                    }}
                  />
                </View>
                <MobileBottomNavigation />
              </View>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
