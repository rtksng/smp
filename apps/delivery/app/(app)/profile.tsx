import { StyleSheet, Text, View } from "react-native";
import { Switch } from "heroui-native/switch";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { StatusPill } from "../../components/StatusPill";
import {
  EmptyState,
  SectionCard
} from "../../components/ui/delivery-card";
import {
  confirmAction,
  errorMessage,
  useAppFeedback
} from "../../components/ui/feedback";
import {
  getMyProfile,
  revokeMyDevices,
  updateOnlineStatus
} from "../../lib/api/delivery";
import { formatDateTime } from "../../lib/delivery/dashboard";
import { useAuth } from "../../lib/auth/auth-context";
import { fonts } from "../../lib/theme";

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
        <View style={styles.retryState}>
          <EmptyState
            icon="warning-outline"
            message={
              profileQuery.isError ? errorMessage(profileQuery.error) : undefined
            }
            title="Profile unavailable"
          />
          <ActionButton
            icon="refresh-outline"
            label="Try again"
            onPress={() => void profileQuery.refetch()}
            tone="secondary"
          />
        </View>
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
        <Info
          label="Documents"
          value={`${profile.documents.filter((document) => document.verifiedAt).length}/${profile.documents.length} verified`}
        />
        {profile.statusReason ? (
          <Info label="Review note" value={profile.statusReason} />
        ) : null}
      </SectionCard>

      <SectionCard>
        <View style={styles.onlineRow}>
          <View>
            <Text style={styles.sectionTitle}>Availability</Text>
            <Text style={styles.meta}>{profile.isOnline ? "Online" : "Offline"}</Text>
          </View>
          <Switch
            accessibilityLabel="Delivery availability"
            isDisabled={onlineMutation.isPending}
            isSelected={profile.isOnline}
            onSelectedChange={(value) => onlineMutation.mutate(value)}
          />
        </View>
      </SectionCard>

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
          icon="create-outline"
          label="Edit profile"
          onPress={() => router.push("/(app)/edit-profile")}
          tone="secondary"
        />
        <ActionButton
          icon="documents-outline"
          label="Documents & verification"
          onPress={() => router.push("/(app)/documents")}
          tone="secondary"
        />
        <ActionButton
          icon="settings-outline"
          label="Permissions & settings"
          onPress={() => router.push("/(app)/settings")}
          tone="secondary"
        />
        <ActionButton
          icon="cloud-upload-outline"
          label="Offline sync"
          onPress={() => router.push("/(app)/sync")}
          tone="secondary"
        />
        <ActionButton
          icon="help-buoy-outline"
          label="Help & incidents"
          onPress={() => router.push("/(app)/support")}
          tone="secondary"
        />
        <ActionButton
          icon="log-out-outline"
          label="Sign out"
          onPress={() =>
            confirmAction({
              body: "Queued delivery updates on this device will be removed when you sign out.",
              confirmLabel: "Sign out",
              destructive: true,
              onConfirm: () => {
                void revokeMyDevices(accessToken ?? "")
                  .catch(() => undefined)
                  .then(signOut)
                  .then(() => router.replace("/login"));
              },
              title: "Sign out?"
            })
          }
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
    fontFamily: fonts.bodySemiBold,
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
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "700"
  },
  meta: {
    color: "#64748B",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "700"
  },
  name: {
    color: "#0F172A",
    fontFamily: fonts.headingBold,
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
  retryState: {
    alignSelf: "center",
    maxWidth: 430,
    width: "100%"
  },
  sectionTitle: {
    color: "#0F172A",
    fontFamily: fonts.headingBold,
    fontSize: 16,
    fontWeight: "900"
  }
});
