import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../lib/auth/auth-context";

export default function IndexRoute() {
  const { isReady, session } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0F6F68" />
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
    backgroundColor: "#F3FAF9",
    flex: 1,
    justifyContent: "center"
  }
});
