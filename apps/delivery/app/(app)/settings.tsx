import Constants from "expo-constants";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { EmptyState, SectionCard } from "../../components/ui/delivery-card";
import { getPermissionHealth, openAppSettings } from "../../lib/device/native";
import { fonts } from "../../lib/theme";

export default function SettingsScreen() {
  const permissionQuery = useQuery({
    queryFn: getPermissionHealth,
    queryKey: ["delivery-permissions"]
  });

  return (
    <Screen>
      <SectionCard title="Device permissions">
        <Text selectable style={styles.helper}>
          Location is attached to delivery updates. Camera and Photos are used for proof and documents. Notifications alert you to new assignments.
        </Text>
        {permissionQuery.isLoading ? (
          <EmptyState icon="settings-outline" title="Checking permissions" />
        ) : permissionQuery.data ? (
          <>
            <PermissionRow label="Location" value={permissionQuery.data.location} />
            <PermissionRow label="Camera" value={permissionQuery.data.camera} />
            <PermissionRow label="Photos" value={permissionQuery.data.library} />
            <PermissionRow label="Notifications" value={permissionQuery.data.notifications} />
          </>
        ) : (
          <Text style={styles.error}>Permission status could not be read.</Text>
        )}
        <ActionButton
          icon="settings-outline"
          label="Open device settings"
          onPress={() => void openAppSettings()}
          tone="secondary"
        />
        <ActionButton
          icon="refresh-outline"
          label="Refresh permission status"
          onPress={() => void permissionQuery.refetch()}
          tone="secondary"
        />
      </SectionCard>

      <SectionCard title="About">
        <Info label="App" value={Constants.expoConfig?.name ?? "Surgical Delivery"} />
        <Info label="Version" value={Constants.expoConfig?.version ?? "Unknown"} />
        <Info label="Build" value={String(Constants.nativeBuildVersion ?? "Development")} />
      </SectionCard>

      <SectionCard title="Privacy and delivery terms">
        <Text selectable style={styles.helper}>
          Location is collected only for delivery operations and status evidence. Proof photos, partner documents, customer contact details, and COD records must be used only to complete assigned deliveries.
        </Text>
        <Text selectable style={styles.helper}>
          Do not copy customer data to personal apps or retain delivery photos outside this app. Follow delivery-operations instructions for cash handover, failed deliveries, and incident escalation.
        </Text>
      </SectionCard>
    </Screen>
  );
}

function PermissionRow({ label, value }: { label: string; value: string }) {
  const granted = value === "GRANTED";

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={granted ? styles.granted : styles.denied}>
        {value.toLowerCase().replaceAll("_", " ")}
      </Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  denied: {
    color: "#92400E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  error: {
    color: "#B91C1C",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "700"
  },
  granted: {
    color: "#0F6F68",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  helper: {
    color: "#607A77",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20
  },
  label: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "800"
  },
  row: {
    alignItems: "center",
    borderTopColor: "#CBDEDB",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42
  },
  value: {
    color: "#123432",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "800"
  }
});
