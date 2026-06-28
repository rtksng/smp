import { StyleSheet, Text, View } from "react-native";
import { Switch } from "heroui-native/switch";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { StatusPill } from "../../components/StatusPill";
import {
  EmptyState,
  MetricCard,
  SectionCard
} from "../../components/ui/delivery-card";
import {
  errorMessage,
  useAppFeedback
} from "../../components/ui/feedback";
import { formatCurrency } from "../../lib/api/status";
import { getMyProfile, updateOnlineStatus } from "../../lib/api/delivery";
import { formatDateTime } from "../../lib/delivery/dashboard";
import { useAuth } from "../../lib/auth/auth-context";

export default function ProfileScreen() {
  const { accessToken, signOut } = useAuth();
  const feedback = useAppFeedback();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyProfile(accessToken ?? ""),
    queryKey: ["delivery-profile"]
  });
  const onlineMutation = useMutation({
    mutationFn: (isOnline: boolean) => updateOnlineStatus(accessToken ?? "", isOnline),
    onError: (error) => feedback.error(errorMessage(error)),
    onSuccess: (profile) => {
      feedback.success(profile.isOnline ? "You are online." : "You are offline.");
      void queryClient.invalidateQueries({ queryKey: ["delivery-profile"] });
    }
  });

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <EmptyState icon="person-circle-outline" title="Loading profile" />
      </Screen>
    );
  }

  const profile = profileQuery.data;

  if (!profile) {
    return (
      <Screen>
        <EmptyState
          icon="warning-outline"
          message={
            profileQuery.isError ? errorMessage(profileQuery.error) : undefined
          }
          title="Profile unavailable"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionCard>
        <View style={styles.profileTop}>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{profile.fullName}</Text>
            <Text style={styles.meta}>{profile.mobileNumber}</Text>
          </View>
          <StatusPill status={profile.status} />
        </View>
        <Info label="Vehicle" value={profile.vehicleNumber ?? "Not set"} />
        <Info label="Email" value={profile.email ?? "Not set"} />
      </SectionCard>

      <SectionCard>
        <View style={styles.onlineRow}>
          <View>
            <Text style={styles.sectionTitle}>Availability</Text>
            <Text style={styles.meta}>{profile.isOnline ? "Online" : "Offline"}</Text>
          </View>
          <Switch
            isDisabled={onlineMutation.isPending}
            isSelected={profile.isOnline}
            onSelectedChange={(value) => onlineMutation.mutate(value)}
          />
        </View>
      </SectionCard>

      <View style={styles.metrics}>
        <MetricCard label="Balance" value={formatCurrency(profile.wallet.balance)} />
        <MetricCard
          label="Earnings"
          tone="success"
          value={formatCurrency(profile.wallet.totalEarnings)}
        />
      </View>

      <SectionCard title="Location">
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
        <Info
          label="Updated"
          value={formatDateTime(profile.lastKnownLocation?.updatedAt)}
        />
      </SectionCard>

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
      <Text numberOfLines={2} selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8
  },
  infoLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "800",
    width: 78
  },
  infoRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
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
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  name: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900"
  },
  nameBlock: {
    flex: 1,
    gap: 4
  },
  onlineRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  profileTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900"
  }
});
