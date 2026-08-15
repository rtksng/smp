import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { EmptyState, SectionCard } from "../../components/ui/delivery-card";
import { FormField } from "../../components/ui/form-field";
import { errorMessage, useAppFeedback } from "../../components/ui/feedback";
import {
  createIncident,
  getSupportContact,
  listIncidents,
  uploadDeliveryProof
} from "../../lib/api/delivery";
import type { DeliveryIncidentType } from "../../lib/api/types";
import { useAuth } from "../../lib/auth/auth-context";
import {
  openEmailAddress,
  openPhoneNumber,
  pickIncidentImage,
  showPermissionSettingsAlert,
  type ProofImageAsset
} from "../../lib/device/native";
import { formatDateTime } from "../../lib/delivery/dashboard";
import { fonts } from "../../lib/theme";

const INCIDENT_TYPES: Array<[DeliveryIncidentType, string]> = [
  ["CUSTOMER_UNREACHABLE", "Customer unreachable"],
  ["INCORRECT_ADDRESS", "Incorrect address"],
  ["PACKAGE_DAMAGED", "Package damaged"],
  ["PACKAGE_MISSING", "Package missing"],
  ["VEHICLE_BREAKDOWN", "Vehicle breakdown"],
  ["PAYMENT_DISPUTE", "Payment dispute"],
  ["OTHER", "Other"]
];

export default function SupportScreen() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId?: string }>();
  const { accessToken } = useAuth();
  const feedback = useAppFeedback();
  const queryClient = useQueryClient();
  const [type, setType] = useState<DeliveryIncidentType>("CUSTOMER_UNREACHABLE");
  const [note, setNote] = useState("");
  const [asset, setAsset] = useState<ProofImageAsset | null>(null);
  const supportQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getSupportContact(accessToken ?? ""),
    queryKey: ["delivery-support"]
  });
  const incidentsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listIncidents(accessToken ?? ""),
    queryKey: ["delivery-incidents"]
  });
  const incidentMutation = useMutation({
    mutationFn: async () => {
      if (!assignmentId) {
        throw new Error("Open a delivery before reporting an assignment incident.");
      }

      const uploaded = asset
        ? await uploadDeliveryProof(accessToken ?? "", {
            name: asset.fileName,
            type: asset.mimeType,
            uri: asset.uri
          })
        : null;

      return createIncident(accessToken ?? "", assignmentId, {
        note: note.trim() || undefined,
        photoKey: uploaded?.key,
        photoUrl: uploaded?.url,
        type
      });
    },
    onError: (error) => feedback.error(errorMessage(error)),
    onSuccess: () => {
      feedback.success("Delivery operations can now review this incident.");
      setNote("");
      setAsset(null);
      void queryClient.invalidateQueries({ queryKey: ["delivery-incidents"] });
    }
  });

  return (
    <Screen>
      <SectionCard title="Contact delivery operations">
        {supportQuery.data?.phone ? (
          <ActionButton
            icon="call-outline"
            label={`Call ${supportQuery.data.phone}`}
            onPress={() => void openPhoneNumber(supportQuery.data?.phone ?? "")}
          />
        ) : null}
        {supportQuery.data?.email ? (
          <ActionButton
            icon="mail-outline"
            label={`Email ${supportQuery.data.email}`}
            onPress={() => void openEmailAddress(supportQuery.data?.email ?? "")}
            tone="secondary"
          />
        ) : null}
        {!supportQuery.data?.phone && !supportQuery.data?.email ? (
          <Text selectable style={styles.helper}>
            A support phone or email has not been configured. You can still report an assignment incident below.
          </Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Report an incident">
        {!assignmentId ? (
          <Text selectable style={styles.warning}>
            Open the affected delivery and choose "Report delivery incident" so the report is linked to the correct order.
          </Text>
        ) : (
          <>
            <Text selectable style={styles.assignment}>Delivery {assignmentId.slice(0, 8)}</Text>
            <View style={styles.types}>
              {INCIDENT_TYPES.map(([value, label]) => {
                const selected = type === value;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={value}
                    onPress={() => setType(value)}
                    style={[styles.type, selected && styles.typeSelected]}
                  >
                    <Text style={selected ? styles.typeTextSelected : styles.typeText}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <FormField
              label="Incident details"
              multiline
              onChangeText={setNote}
              placeholder="What happened and what help do you need?"
              value={note}
            />
            <ActionButton
              icon="camera-outline"
              label={asset ? "Change incident photo" : "Add incident photo"}
              onPress={async () => {
                const result = await pickIncidentImage();

                if (result.status === "permission-denied") {
                  if (!result.canAskAgain) {
                    showPermissionSettingsAlert({
                      body: "Enable Camera or Photos in Settings to attach an incident photo.",
                      title: "Photo permission is off"
                    });
                  }
                  return;
                }

                if (result.status === "selected") {
                  setAsset(result.asset);
                }
              }}
              tone="secondary"
            />
            {asset ? (
              <Image
                accessibilityLabel="Selected incident photo"
                resizeMode="cover"
                source={{ uri: asset.uri }}
                style={styles.preview}
              />
            ) : null}
            <ActionButton
              icon="warning-outline"
              label="Submit incident"
              loading={incidentMutation.isPending}
              onPress={() => incidentMutation.mutate()}
            />
          </>
        )}
      </SectionCard>

      <SectionCard title="Recent incidents">
        {incidentsQuery.isLoading ? (
          <EmptyState icon="time-outline" title="Loading incidents" />
        ) : (incidentsQuery.data?.items.length ?? 0) === 0 ? (
          <Text style={styles.helper}>No incidents reported.</Text>
        ) : (
          incidentsQuery.data?.items.map((incident) => (
            <Pressable
              accessibilityRole="button"
              key={incident.id}
              onPress={() =>
                router.push({
                  params: { id: incident.deliveryAssignmentId },
                  pathname: "/(app)/assignments/[id]"
                })
              }
              style={styles.incidentRow}
            >
              <View style={styles.incidentText}>
                <Text selectable style={styles.incidentTitle}>
                  {incident.type.toLowerCase().replaceAll("_", " ")}
                </Text>
                <Text selectable style={styles.meta}>{formatDateTime(incident.createdAt)}</Text>
              </View>
              <Text style={incident.status === "OPEN" ? styles.open : styles.resolved}>
                {incident.status.toLowerCase()}
              </Text>
            </Pressable>
          ))
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  assignment: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 14,
    fontWeight: "900"
  },
  helper: {
    color: "#55716E",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20
  },
  incidentRow: {
    alignItems: "center",
    borderTopColor: "#CBDEDB",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    minHeight: 50,
    paddingVertical: 6
  },
  incidentText: { flex: 1, gap: 3 },
  incidentTitle: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  meta: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "700"
  },
  open: {
    color: "#B91C1C",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  preview: { borderRadius: 10, height: 190, width: "100%" },
  resolved: {
    color: "#0F6F68",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize"
  },
  type: {
    backgroundColor: "#EEF6F5",
    borderColor: "#C4E4E0",
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 11,
    paddingVertical: 8
  },
  typeSelected: { backgroundColor: "#E5F5F3", borderColor: "#0F6F68" },
  typeText: {
    color: "#2B4946",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "800"
  },
  typeTextSelected: {
    color: "#0F6F68",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "900"
  },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  warning: {
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    color: "#9A3412",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    padding: 7
  }
});
