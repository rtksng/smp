import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { StatusPill } from "../../components/StatusPill";
import { formatCurrency } from "../../lib/api/status";
import { getMyProfile, updateOnlineStatus } from "../../lib/api/delivery";
import { useAuth } from "../../lib/auth/auth-context";

export default function ProfileScreen() {
  const { accessToken, signOut } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyProfile(accessToken ?? ""),
    queryKey: ["delivery-profile"]
  });
  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => updateOnlineStatus(accessToken ?? "", isOnline),
    onError: showError,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-profile"] });
    }
  });

  if (profileQuery.isLoading) {
    return (
      <Screen scroll={false} style={styles.center}>
        <ActivityIndicator color="#155E63" />
      </Screen>
    );
  }

  const profile = profileQuery.data;

  if (!profile) {
    return (
      <Screen scroll={false} style={styles.center}>
        <Text style={styles.emptyText}>Profile unavailable</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.card}>
        <View style={styles.profileTop}>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{profile.fullName}</Text>
            <Text style={styles.meta}>{profile.mobileNumber}</Text>
          </View>
          <StatusPill status={profile.status} />
        </View>
        <Info label="Vehicle" value={profile.vehicleNumber ?? "Not set"} />
        <Info label="Email" value={profile.email ?? "Not set"} />
      </View>

      <View style={styles.card}>
        <View style={styles.onlineRow}>
          <View>
            <Text style={styles.sectionTitle}>Availability</Text>
            <Text style={styles.meta}>{profile.isOnline ? "Online" : "Offline"}</Text>
          </View>
          <Switch
            ios_backgroundColor="#CBD5E1"
            onValueChange={(value) => onlineMutation.mutate(value)}
            trackColor={{ false: "#CBD5E1", true: "#99F6E4" }}
            value={profile.isOnline}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Wallet</Text>
        <Info label="Balance" value={formatCurrency(profile.wallet.balance)} />
        <Info
          label="Earnings"
          value={formatCurrency(profile.wallet.totalEarnings)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Info
          label="Latitude"
          value={
            profile.lastKnownLocation?.latitude === null ||
            profile.lastKnownLocation?.latitude === undefined
              ? "Not available"
              : String(profile.lastKnownLocation.latitude)
          }
        />
        <Info
          label="Longitude"
          value={
            profile.lastKnownLocation?.longitude === null ||
            profile.lastKnownLocation?.longitude === undefined
              ? "Not available"
              : String(profile.lastKnownLocation.longitude)
          }
        />
      </View>

      <View style={styles.actions}>
        <ActionButton
          icon="arrow-back-outline"
          label="Deliveries"
          onPress={() => router.replace("/(app)/assignments")}
          tone="secondary"
        />
        <ActionButton
          icon="log-out-outline"
          label="Sign out"
          onPress={() => {
            void signOut().then(() => router.replace("/login"));
          }}
          tone="danger"
        />
      </View>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function showError(error: unknown) {
  Alert.alert("Request failed", error instanceof Error ? error.message : "Try again.");
}

const styles = StyleSheet.create({
  actions: {
    gap: 10
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14
  },
  center: {
    alignItems: "center",
    justifyContent: "center"
  },
  emptyText: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "800"
  },
  infoLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "800",
    width: 92
  },
  infoRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  infoValue: {
    color: "#0F172A",
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  meta: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700"
  },
  name: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900"
  },
  nameBlock: {
    flex: 1,
    gap: 5
  },
  onlineRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900"
  }
});
