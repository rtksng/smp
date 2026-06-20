import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../lib/auth/auth-context";

export default function IndexRoute() {
  const { isReady, session } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#155E63" />
      </View>
    );
  }

  return session ? (
    <Redirect href="/(app)/assignments" />
  ) : (
    <Redirect href="/login" />
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    flex: 1,
    justifyContent: "center"
  }
});
