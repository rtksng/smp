import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";
import { ActionButton } from "../../../components/ActionButton";
import { Screen } from "../../../components/Screen";
import { StatusPill } from "../../../components/StatusPill";
import { FormField } from "../../../components/ui/form-field";
import {
  EmptyState,
  SectionCard
} from "../../../components/ui/delivery-card";
import {
  confirmAction,
  errorMessage,
  useAppFeedback
} from "../../../components/ui/feedback";
import {
  assignmentDestination,
  formatCurrency,
  isCodAssignment,
  nextStatuses,
  statusLabel
} from "../../../lib/api/status";
import type {
  DeliveryStatus,
  StatusUpdateInput
} from "../../../lib/api/types";
import {
  listAssignments,
  updateAssignmentStatus,
  updateLocation,
  uploadDeliveryProof
} from "../../../lib/api/delivery";
import {
  getCurrentCoordinates,
  openMapsDestination,
  pickProofImage,
  successHaptic
} from "../../../lib/device/native";
import { useStatusQueue } from "../../../lib/offline/status-queue-context";
import { validateDeliveryStatusForm } from "../../../lib/delivery/forms";
import { formatDateTime } from "../../../lib/delivery/dashboard";
import { useAuth } from "../../../lib/auth/auth-context";

type StatusFormErrors = Partial<{
  cashCollectedAmount: string;
  failureReason: string;
  proof: string;
  receiverName: string;
}>;

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const feedback = useAppFeedback();
  const queryClient = useQueryClient();
  const netInfo = useNetInfo();
  const { enqueueUpdate, queuedUpdates } = useStatusQueue();
  const [note, setNote] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [cashCollectedAmount, setCashCollectedAmount] = useState("");
  const [formErrors, setFormErrors] = useState<StatusFormErrors>({});
  const [proofAsset, setProofAsset] = useState<{
    mimeType?: string;
    uri: string;
  } | null>(null);
  const assignmentsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAssignments(accessToken ?? ""),
    queryKey: ["delivery-assignments", "all"]
  });
  const assignment = useMemo(
    () => assignmentsQuery.data?.items.find((item) => item.id === id) ?? null,
    [assignmentsQuery.data?.items, id]
  );
  const statusMutation = useMutation({
    mutationFn: (input: { assignmentId: string; payload: StatusUpdateInput }) =>
      updateAssignmentStatus(accessToken ?? "", input.assignmentId, input.payload),
    onError: (error) => feedback.error(errorMessage(error)),
    onSuccess: async () => {
      await successHaptic();
      feedback.success("Delivery status updated.");
      resetStatusForm();
      await queryClient.invalidateQueries({ queryKey: ["delivery-assignments"] });
    }
  });

  if (assignmentsQuery.isLoading) {
    return (
      <Screen>
        <EmptyState icon="cube-outline" title="Loading delivery" />
      </Screen>
    );
  }

  if (!assignment) {
    return (
      <Screen>
        <EmptyState
          icon="warning-outline"
          message={
            assignmentsQuery.isError ? errorMessage(assignmentsQuery.error) : undefined
          }
          title="Delivery not found"
        />
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

    const validation = validateDeliveryStatusForm({
      cashCollectedAmount,
      expectedCodAmount: assignment.payment.codAmount,
      failureReason,
      isCod,
      proofSelected: Boolean(proofAsset || assignment.proofOfDeliveryUrl),
      receiverName,
      status
    });
    setFormErrors(validation.errors);

    if (!validation.isValid) {
      feedback.warning("Check the highlighted delivery details.");
      return;
    }

    if (netInfo.isConnected === false && status === "DELIVERED") {
      feedback.warning(
        "Connect to the internet to upload proof before completing delivery."
      );
      return;
    }

    let proof:
      | {
          key: string;
          url: string;
        }
      | null = assignment.proofOfDeliveryKey && assignment.proofOfDeliveryUrl
      ? {
          key: assignment.proofOfDeliveryKey,
          url: assignment.proofOfDeliveryUrl
        }
      : null;

    try {
      if (status === "DELIVERED" && proofAsset && !proof) {
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

      const coordinates = await getCurrentCoordinates();
      const payload: StatusUpdateInput = {
        cashCollectedAmount: validation.values.cashCollectedAmount,
        failureReason: validation.values.failureReason,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        note: note.trim() || undefined,
        proofOfDeliveryKey: proof?.key,
        proofOfDeliveryUrl: proof?.url,
        receiverName: validation.values.receiverName,
        status
      };

      if (coordinates && netInfo.isConnected !== false) {
        await updateLocation(accessToken, coordinates).catch(() => undefined);
      }

      if (netInfo.isConnected === false) {
        await enqueueUpdate({
          assignmentId: assignment.id,
          payload
        });
        feedback.info("Status will sync when the device reconnects.", "Queued");
        return;
      }

      await statusMutation.mutateAsync({
        assignmentId: assignment.id,
        payload
      });
    } catch (error) {
      feedback.error(errorMessage(error));
    }
  }

  function requestStatus(status: DeliveryStatus) {
    const action = () => void submitStatus(status);

    if (status === "FAILED" || status === "CANCELLED" || status === "DELIVERED") {
      confirmAction({
        body: `This will mark ${
          assignment?.orderNumber ?? "this delivery"
        } as ${statusLabel(status).toLowerCase()}.`,
        confirmLabel:
          status === "FAILED" ? "Fail" : status === "DELIVERED" ? "Deliver" : "Confirm",
        onConfirm: action,
        title: `Confirm ${statusLabel(status)}`
      });
      return;
    }

    action();
  }

  function resetStatusForm() {
    setNote("");
    setFailureReason("");
    setReceiverName("");
    setCashCollectedAmount("");
    setProofAsset(null);
    setFormErrors({});
  }

  return (
    <Screen>
      <SectionCard>
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
      </SectionCard>

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

      {assignment.pickupWarehouse ? (
        <SectionCard title="Pickup warehouse">
          <Info label="Name" value={assignment.pickupWarehouse.name} />
          <Info
            label="Contact"
            value={`${assignment.pickupWarehouse.contactPerson} (${assignment.pickupWarehouse.contactNumber})`}
          />
          <Info
            label="Address"
            value={[
              assignment.pickupWarehouse.address,
              assignment.pickupWarehouse.city,
              assignment.pickupWarehouse.state,
              assignment.pickupWarehouse.pincode
            ]
              .filter(Boolean)
              .join(", ")}
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Payment and totals">
        <Info
          label="Payment"
          value={
            isCod
              ? `COD ${formatCurrency(assignment.payment.codAmount)}`
              : "Paid online"
          }
        />
        <Info label="Subtotal" value={formatCurrency(assignment.totals.subtotal)} />
        <Info label="Tax" value={formatCurrency(assignment.totals.taxTotal)} />
        <Info label="Grand total" value={formatCurrency(assignment.totals.grandTotal)} />
      </SectionCard>

      <SectionCard title="Items">
        {assignment.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSku}>{item.sku}</Text>
            </View>
            <Text style={styles.itemQty}>x{item.quantity}</Text>
          </View>
        ))}
      </SectionCard>

      {assignment.orderNotes ? (
        <SectionCard title="Order notes">
          <Text selectable style={styles.noteText}>
            {assignment.orderNotes}
          </Text>
        </SectionCard>
      ) : null}

      {canDeliver || canFail ? (
        <SectionCard title="Update delivery">
          {canDeliver ? (
            <>
              <FormField
                error={formErrors.receiverName}
                label="Receiver name"
                onChangeText={setReceiverName}
                required
                value={receiverName}
              />
              {isCod ? (
                <FormField
                  error={formErrors.cashCollectedAmount}
                  keyboardType="numeric"
                  label="Cash collected"
                  onChangeText={setCashCollectedAmount}
                  required
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
                    setFormErrors((errors) => ({ ...errors, proof: undefined }));
                    feedback.success("Proof photo attached.", "Proof selected");
                  }
                }}
                tone="secondary"
              />
              {formErrors.proof ? (
                <Text style={styles.errorText}>{formErrors.proof}</Text>
              ) : null}
              {proofAsset || assignment.proofOfDeliveryUrl ? (
                <Text selectable style={styles.proofText}>
                  {proofAsset?.uri ?? assignment.proofOfDeliveryUrl}
                </Text>
              ) : null}
            </>
          ) : null}

          {canFail ? (
            <FormField
              error={formErrors.failureReason}
              label="Failure reason"
              multiline
              onChangeText={setFailureReason}
              value={failureReason}
            />
          ) : null}

          <FormField label="Note" multiline onChangeText={setNote} value={note} />
        </SectionCard>
      ) : null}

      <View style={styles.actions}>
        {transitions.map((status) => (
          <ActionButton
            icon={
              status === "DELIVERED"
                ? "checkmark-circle-outline"
                : "arrow-forward-outline"
            }
            key={status}
            label={statusActionLabel(status)}
            loading={statusMutation.isPending}
            onPress={() => requestStatus(status)}
            tone={status === "FAILED" || status === "CANCELLED" ? "danger" : "primary"}
          />
        ))}
      </View>

      <SectionCard title="Timeline">
        {assignment.statusHistory.length === 0 ? (
          <Text style={styles.meta}>No delivery movement has been recorded yet.</Text>
        ) : (
          assignment.statusHistory.map((entry) => (
            <View key={entry.id} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineStatus}>{statusLabel(entry.status)}</Text>
                <Text style={styles.meta}>{formatDateTime(entry.createdAt)}</Text>
                {entry.note ? <Text style={styles.noteText}>{entry.note}</Text> : null}
              </View>
            </View>
          ))
        )}
      </SectionCard>

      {queuedUpdates.length > 0 ? (
        <View style={styles.queueBanner}>
          <Ionicons color="#92400E" name="cloud-offline-outline" size={18} />
          <Text style={styles.queueText}>
            {queuedUpdates.length} queued update
            {queuedUpdates.length === 1 ? "" : "s"} waiting to sync
          </Text>
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
      <Text selectable style={styles.infoText}>
        {value}
      </Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailInfoRow}>
      <Text style={styles.detailInfoLabel}>{label}</Text>
      <Text numberOfLines={3} selectable style={styles.detailInfoValue}>
        {value}
      </Text>
    </View>
  );
}

function statusActionLabel(status: DeliveryStatus) {
  if (status === "ACCEPTED") {
    return "Accept";
  }

  return `Mark ${statusLabel(status)}`;
}

const styles = StyleSheet.create({
  actions: {
    gap: 8
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  customer: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700"
  },
  detailInfoLabel: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "800",
    width: 78
  },
  detailInfoRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  detailInfoValue: {
    color: "#0F172A",
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "800"
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
  itemName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800"
  },
  itemQty: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "900"
  },
  itemRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between"
  },
  itemSku: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700"
  },
  itemText: {
    flex: 1,
    gap: 3
  },
  meta: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700"
  },
  noteText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20
  },
  orderNumber: {
    color: "#0F172A",
    fontSize: 21,
    fontWeight: "900"
  },
  proofText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700"
  },
  queueBanner: {
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  queueText: {
    color: "#92400E",
    flex: 1,
    fontSize: 13,
    fontWeight: "800"
  },
  timelineContent: {
    flex: 1,
    gap: 3
  },
  timelineDot: {
    backgroundColor: "#287C30",
    borderRadius: 999,
    height: 10,
    marginTop: 5,
    width: 10
  },
  timelineRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8
  },
  timelineStatus: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "900"
  },
  titleBlock: {
    flex: 1,
    gap: 5,
    minWidth: 0
  }
});
