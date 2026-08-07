import "react-native-gesture-handler";
import "../global.css";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native/provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth/auth-context";
import { NativeAppLifecycle } from "../lib/device/app-lifecycle";
import { StatusQueueProvider } from "../lib/offline/status-queue-context";
import { fonts } from "../lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 20_000
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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <HeroUINativeProvider
            config={{
              devInfo: {
                stylingPrinciples: false
              },
              toast: {
                maxVisibleToasts: 3
              }
            }}
          >
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <NativeAppLifecycle />
                <StatusQueueProvider>
                  <StatusBar style="dark" />
                  <Stack
                    screenOptions={{
                      contentStyle: { backgroundColor: "#F8FAFC" },
                      headerBackButtonDisplayMode: "minimal",
                      headerShown: false,
                      headerShadowVisible: false,
                      headerStyle: { backgroundColor: "#F8FAFC" },
                      headerTitleStyle: {
                        color: "#0F172A",
                        fontFamily: fonts.headingBold,
                        fontSize: 18,
                        fontWeight: "800"
                      }
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="login"
                      options={{
                        headerShown: false
                      }}
                    />
                    <Stack.Screen
                      name="application-status"
                      options={{ title: "Application status" }}
                    />
                    <Stack.Screen name="(app)" options={{ headerShown: false }} />
                  </Stack>
                </StatusQueueProvider>
              </AuthProvider>
            </QueryClientProvider>
          </HeroUINativeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
