import "react-native-gesture-handler";
import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native/provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth/auth-context";
import { StatusQueueProvider } from "../lib/offline/status-queue-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000
    }
  }
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
              <StatusQueueProvider>
                <StatusBar style="dark" />
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
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="login"
                    options={{
                      headerShown: false
                    }}
                  />
                  <Stack.Screen name="(app)" options={{ headerShown: false }} />
                </Stack>
              </StatusQueueProvider>
            </AuthProvider>
          </QueryClientProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
