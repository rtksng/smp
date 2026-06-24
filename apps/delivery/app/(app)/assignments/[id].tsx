import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";
import { ActionButton } from "../../../components/ActionButton";
import { Screen } from "../../../components/Screen";
import { StatusPill } from "../../../components/StatusPill";
import {
  assignmentDestination,
  formatCurrency,
  isCodAssignment,
  nextStatuses,
  statusLabel
} from "../../../lib/api/status";
import type {
  DeliveryAssignment,
  DeliveryStatus,
  StatusUpdateInput
} from "../../../lib/api/types";
import {
  listAssignments,
  updateAssignmentStatus,
  updateLocation,
  uploadDeliveryProof
} from "../../../lib/api/delivery";
import { validateStatusUpdatePayload } from "../../../lib/api/schemas";
import {
  getCurrentCoordinates,
  openMapsDestination,
  pickProofImage,
  successHaptic
} from "../../../lib/device/native";
import {
  enqueueStatusUpdate,
  type QueuedStatusUpdate
} from "../../../lib/offline/status-queue";
import { useAuth } from "../../../lib/auth/auth-context";

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const netInfo = useNetInfo();
  const [note, setNote] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [cashCollectedAmount, setCashCollectedAmount] = useState("");
  const [proofAsset, setProofAsset] = useState<{
    mimeType?: string;
    uri: string;
  } | null>(null);
  const [queuedUpdates, setQueuedUpdates] = useState<QueuedStatusUpdate[]>([]);

  const assignmentsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAssignments(accessToken ?? ""),
    queryKey: ["delivery-assignments"]
  });
  const assignment = useMemo(
    () => assignmentsQuery.data?.items.find((item) => item.id === id) ?? null,
    [assignmentsQuery.data?.items, id]
  );
  const statusMutation = useMutation({
    mutationFn: (input: { assignmentId: string; payload: StatusUpdateInput }) =>
      updateAssignmentStatus(accessToken ?? "", input.assignmentId, input.payload),
    onError: showError,
    onSuccess: async () => {
      await successHaptic();
      await queryClient.invalidateQueries({ queryKey: ["delivery-assignments"] });
    }
  });

  if (assignmentsQuery.isLoading) {
    return (
      <Screen scroll={false} style={styles.center}>
        <ActivityIndicator color="#287c30" />
      </Screen>
    );
  }

  if (!assignment) {
    return (
      <Screen scroll={false} style={styles.center}>
        <Text style={styles.emptyText}>Delivery not found</Text>
      </Screen>
    );
  }

  const isCod = isCodAssignment(assignment);
  const transitions = nextStatuses(assignment.status);
  const canDeliver = transitions.includes("DELIVERED");
  const canFail = transitions.includes("FAILED");

  async function submitStatus(status: DeliveryStatus) {
    if (!assignment || !accessToken) {
      return;
    }

    let proof:
      | {
          key: string;
          url: string;
        }
      | null = null;

    try {
      if (status === "DELIVERED" && proofAsset) {
        const uploaded = await uploadDeliveryProof(accessToken, {
          name: proofAsset.uri.split("/").pop() ?? "delivery-proof.jpg",
          type: proofAsset.mimeType ?? "image/jpeg",
          uri: proofAsset.uri
        });
        proof = {
          key: uploaded.key,
          url: uploaded.url
        };
      }

      const validationMessage = validateStatusUpdatePayload({
        cashCollectedAmount: cashCollectedAmount
          ? Number(cashCollectedAmount)
          : undefined,
        failureReason: failureReason.trim(),
        isCod,
        proofOfDeliveryKey: proof?.key,
        proofOfDeliveryUrl: proof?.url,
        receiverName: receiverName.trim(),
        status
      });

      if (validationMessage) {
        Alert.alert("Missing detail", validationMessage);
        return;
      }

      const coordinates = await getCurrentCoordinates();
      const payload: StatusUpdateInput = {
        cashCollectedAmount: cashCollectedAmount
          ? Number(cashCollectedAmount)
          : undefined,
        failureReason: failureReason.trim() || undefined,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        note: note.trim() || undefined,
        proofOfDeliveryKey: proof?.key,
        proofOfDeliveryUrl: proof?.url,
        receiverName: receiverName.trim() || undefined,
        status
      };

      if (coordinates) {
        await updateLocation(accessToken, coordinates).catch(() => undefined);
      }

      if (netInfo.isConnected === false) {
        setQueuedUpdates((queue) =>
          enqueueStatusUpdate(queue, {
            assignmentId: assignment.id,
            payload
          })
        );
        Alert.alert("Queued", "Status will retry when the device is online.");
        return;
      }

      await statusMutation.mutateAsync({
        assignmentId: assignment.id,
        payload
      });
    } catch (error) {
      if (netInfo.isConnected === false) {
        setQueuedUpdates((queue) =>
          enqueueStatusUpdate(queue, {
            assignmentId: assignment.id,
            payload: {
              failureReason: failureReason.trim() || undefined,
              note: note.trim() || undefined,
              status
            }
          })
        );
        return;
      }

      showError(error);
    }
  }

  return (
    <Screen>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <Text style={styles.orderNumber}>{assignment.orderNumber}</Text>
            <Text style={styles.customer}>
              {assignment.customer.businessName ?? assignment.customer.fullName}
            </Text>
          </View>
          <StatusPill status={assignment.status} />
        </View>
        <InfoRow icon="call-outline" value={assignment.customer.mobileNumber} />
        <InfoRow icon="location-outline" value={assignmentDestination(assignment)} />
        <InfoRow
          icon="cash-outline"
          value={
            isCod
              ? `COD ${formatCurrency(assignment.payment.codAmount)}`
              : "Paid online"
          }
        />
      </View>

      <View style={styles.buttonRow}>
        <ActionButton
          icon="navigate-outline"
          label="Maps"
          onPress={() =>
            openMapsDestination({
              latitude: assignment.shippingAddress?.latitude ?? null,
              longitude: assignment.shippingAddress?.longitude ?? null,
              query: assignmentDestination(assignment)
            })
          }
          tone="secondary"
        />
        <ActionButton
          icon="call-outline"
          label="Call"
          onPress={() => Linking.openURL(`tel:${assignment.customer.mobileNumber}`)}
          tone="secondary"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>
        {assignment.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemQty}>x{item.quantity}</Text>
          </View>
        ))}
      </View>

      {canDeliver || canFail ? (
        <View style={styles.card}>
          {canDeliver ? (
            <>
              <Field
                keyboardType="default"
                label="Receiver name"
                onChangeText={setReceiverName}
                value={receiverName}
              />
              {isCod ? (
                <Field
                  keyboardType="numeric"
                  label="Cash collected"
                  onChangeText={setCashCollectedAmount}
                  value={cashCollectedAmount}
                />
              ) : null}
              <ActionButton
                icon="camera-outline"
                label={proofAsset ? "Proof selected" : "Capture proof"}
                onPress={async () => {
                  const result = await pickProofImage();
                  if (result && !result.canceled && result.assets[0]) {
                    setProofAsset({
                      mimeType: result.assets[0].mimeType,
                      uri: result.assets[0].uri
                    });
                  }
                }}
                tone="secondary"
              />
            </>
          ) : null}

          {canFail ? (
            <Field
              label="Failure reason"
              multiline
              onChangeText={setFailureReason}
              value={failureReason}
            />
          ) : null}

          <Field label="Note" multiline onChangeText={setNote} value={note} />
        </View>
      ) : null}

      <View style={styles.actions}>
        {transitions.map((status) => (
          <ActionButton
            icon={status === "DELIVERED" ? "checkmark-circle-outline" : "arrow-forward-outline"}
            key={status}
            label={statusActionLabel(status)}
            loading={statusMutation.isPending}
            onPress={() => void submitStatus(status)}
            tone={status === "FAILED" || status === "CANCELLED" ? "danger" : "primary"}
          />
        ))}
      </View>

      {queuedUpdates.length > 0 ? (
        <View style={styles.queueBanner}>
          <Ionicons color="#92400E" name="cloud-offline-outline" size={18} />
          <Text style={styles.queueText}>{queuedUpdates.length} queued update</Text>
        </View>
      ) : null}
    </Screen>
  );
}

function InfoRow({
  icon,
  value
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons color="#475569" name={icon} size={17} />
      <Text style={styles.infoText}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#94A3B8"
        style={[styles.input, props.multiline && styles.textArea]}
        {...props}
      />
    </View>
  );
}

function statusActionLabel(status: DeliveryStatus) {
  if (status === "ACCEPTED") {
    return "Accept";
  }

  return `Mark ${statusLabel(status)}`;
}

function showError(error: unknown) {
  Alert.alert("Request failed", error instanceof Error ? error.message : "Try again.");
}

const styles = StyleSheet.create({
  actions: {
    gap: 10
  },
  buttonRow: {
    flexDirection: "row",
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
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  center: {
    alignItems: "center",
    justifyContent: "center"
  },
  customer: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700"
  },
  emptyText: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "800"
  },
  field: {
    gap: 7
  },
  infoRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  infoText: {
    color: "#334155",
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0F172A",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12
  },
  itemName: {
    color: "#0F172A",
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  itemQty: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "800"
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700"
  },
  orderNumber: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "900"
  },
  queueBanner: {
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    padding: 12
  },
  queueText: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "800"
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900"
  },
  textArea: {
    minHeight: 86,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  titleBlock: {
    flex: 1,
    gap: 5,
    minWidth: 0
  }
});
