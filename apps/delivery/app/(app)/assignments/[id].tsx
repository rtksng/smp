import { useRef, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";
import { ActionButton } from "../../../components/ActionButton";
import { KeyboardAccessory } from "../../../components/KeyboardAccessory";
import { Screen } from "../../../components/Screen";
import { StatusPill } from "../../../components/StatusPill";
import { ConnectivityBanner } from "../../../components/ui/connectivity-banner";
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
  getAssignment,
  updateAssignmentStatus,
  updateLocation,
  uploadDeliveryProof
} from "../../../lib/api/delivery";
import {
  getCurrentCoordinates,
  openMapsDestination,
  openPhoneNumber,
  pickProofImage,
  showPermissionSettingsAlert,
  successHaptic
} from "../../../lib/device/native";
import type { ProofImageAsset } from "../../../lib/device/native";
import { useStatusQueue } from "../../../lib/offline/status-queue-context";
import { MAX_STATUS_UPDATE_ATTEMPTS } from "../../../lib/offline/status-queue";
import { validateDeliveryStatusForm } from "../../../lib/delivery/forms";
import { formatDateTime } from "../../../lib/delivery/dashboard";
import { useAuth } from "../../../lib/auth/auth-context";
import { fonts } from "../../../lib/theme";

type StatusFormErrors = Partial<{
  cashCollectedAmount: string;
  failureReason: string;
  proof: string;
  receiverName: string;
}>;

const KEYBOARD_ACCESSORY_ID = "delivery-status-keyboard";

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessToken } = useAuth();
  const feedback = useAppFeedback();
  const queryClient = useQueryClient();
  const netInfo = useNetInfo();
  const { discardUpdate, enqueueUpdate, queuedUpdates, retryUpdate } =
    useStatusQueue();
  const [note, setNote] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [cashCollectedAmount, setCashCollectedAmount] = useState("");
  const [formErrors, setFormErrors] = useState<StatusFormErrors>({});
  const [proofAsset, setProofAsset] = useState<ProofImageAsset | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState<DeliveryStatus | null>(
    null
  );
  const cashRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);
  const assignmentQuery = useQuery({
    enabled: Boolean(accessToken && id),
    queryFn: () => getAssignment(accessToken ?? "", id),
    queryKey: ["delivery-assignment", id]
  });
  const assignment = assignmentQuery.data ?? null;
  const statusMutation = useMutation({
    mutationFn: (input: { assignmentId: string; payload: StatusUpdateInput }) =>
      updateAssignmentStatus(accessToken ?? "", input.assignmentId, input.payload),
    onSuccess: async (updatedAssignment) => {
      await successHaptic();
      feedback.success("Delivery status updated.");
      resetStatusForm();
      queryClient.setQueryData(
        ["delivery-assignment", updatedAssignment.id],
        updatedAssignment
      );
      await queryClient.invalidateQueries({ queryKey: ["delivery-assignments"] });
      await queryClient.invalidateQueries({ queryKey: ["delivery-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["delivery-cash"] });
    }
  });

  if (assignmentQuery.isLoading) {
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
            assignmentQuery.isError ? errorMessage(assignmentQuery.error) : undefined
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
  const canCancel = transitions.includes("CANCELLED");
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;
  const queuedForAssignment = queuedUpdates.find(
    (item) => item.assignmentId === assignment.id
  );
  const stalledUpdate =
    queuedForAssignment &&
    queuedForAssignment.attempts >= MAX_STATUS_UPDATE_ATTEMPTS
      ? queuedForAssignment
      : null;

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

    if (isOffline && status === "DELIVERED") {
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

    setSubmittingStatus(status);
    try {
      if (status === "DELIVERED" && proofAsset && !proof) {
        const uploaded = await uploadDeliveryProof(accessToken, {
          name: proofAsset.fileName,
          type: proofAsset.mimeType,
          uri: proofAsset.uri
        });
        proof = {
          key: uploaded.key,
          url: uploaded.url
        };
      }

      const locationResult = await getCurrentCoordinates();
      const coordinates = locationResult.coordinates;

      if (locationResult.status === "denied" && !locationResult.canAskAgain) {
        showPermissionSettingsAlert({
          body: "Enable Location in Settings to attach GPS coordinates to future delivery updates.",
          title: "Location permission is off"
        });
      } else if (locationResult.status === "services-disabled") {
        feedback.warning(
          "Location Services are off. This update will continue without GPS."
        );
      } else if (locationResult.status === "unavailable") {
        feedback.warning(
          "A location fix was not available. This update will continue without GPS."
        );
      }

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

      if (coordinates && !isOffline) {
        await updateLocation(accessToken, coordinates).catch(() => undefined);
      }

      if (isOffline) {
        await enqueueUpdate({
          assignmentId: assignment.id,
          payload
        });
        feedback.info("Status will sync when the device reconnects.", "Queued");
        resetStatusForm();
        return;
      }

      await statusMutation.mutateAsync({
        assignmentId: assignment.id,
        payload
      });
    } catch (error) {
      feedback.error(errorMessage(error));
    } finally {
      setSubmittingStatus(null);
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

      {queuedForAssignment ? (
        <>
          <ConnectivityBanner
            message={
              stalledUpdate
                ? "This delivery update could not sync after several attempts."
                : "This delivery already has an update waiting to sync."
            }
            tone={stalledUpdate ? "danger" : "warning"}
          />
          {stalledUpdate ? (
            <View style={styles.buttonRow}>
              <ActionButton
                icon="refresh-outline"
                label="Retry sync"
                onPress={() => void retryUpdate(stalledUpdate.id)}
                tone="secondary"
              />
              <ActionButton
                icon="trash-outline"
                label="Discard"
                onPress={() =>
                  confirmAction({
                    body: "The unsynced delivery update will be removed from this device.",
                    confirmLabel: "Discard",
                    destructive: true,
                    onConfirm: () => void discardUpdate(stalledUpdate.id),
                    title: "Discard update?"
                  })
                }
                tone="danger"
              />
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.buttonRow}>
        <ActionButton
          icon="navigate-outline"
          label="Maps"
          onPress={() => {
            void openMapsDestination({
              latitude: assignment.shippingAddress?.latitude ?? null,
              longitude: assignment.shippingAddress?.longitude ?? null,
              query: assignmentDestination(assignment)
            }).catch((error) => feedback.error(errorMessage(error)));
          }}
          tone="secondary"
        />
        <ActionButton
          icon="call-outline"
          label="Call"
          onPress={() => {
            void openPhoneNumber(assignment.customer.mobileNumber).catch((error) =>
              feedback.error(errorMessage(error))
            );
          }}
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
          <View style={styles.buttonRow}>
            <ActionButton
              icon="navigate-outline"
              label="Warehouse maps"
              onPress={() => {
                const warehouse = assignment.pickupWarehouse;

                if (!warehouse) {
                  return;
                }

                void openMapsDestination({
                  latitude: warehouse.latitude,
                  longitude: warehouse.longitude,
                  query: [warehouse.address, warehouse.city, warehouse.state, warehouse.pincode]
                    .filter(Boolean)
                    .join(", ")
                }).catch((error) => feedback.error(errorMessage(error)));
              }}
              tone="secondary"
            />
            <ActionButton
              icon="call-outline"
              label="Call warehouse"
              onPress={() => {
                const phone = assignment.pickupWarehouse?.contactNumber;

                if (phone) {
                  void openPhoneNumber(phone).catch((error) =>
                    feedback.error(errorMessage(error))
                  );
                }
              }}
              tone="secondary"
            />
          </View>
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
        {isCod ? (
          <Info
            label="Settlement"
            value={assignment.payment.cashSettlementStatus
              .toLowerCase()
              .replaceAll("_", " ")}
          />
        ) : null}
      </SectionCard>

      <ActionButton
        icon="warning-outline"
        label="Report delivery incident"
        onPress={() =>
          router.push({
            params: { assignmentId: assignment.id },
            pathname: "/(app)/support"
          })
        }
        tone="secondary"
      />

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

      {canDeliver || canFail || canCancel ? (
        <SectionCard title="Update delivery">
          {canDeliver ? (
            <>
              <FormField
                autoCapitalize="words"
                autoComplete="name"
                autoCorrect={false}
                error={formErrors.receiverName}
                label="Receiver name"
                onChangeText={setReceiverName}
                onSubmitEditing={() =>
                  isCod ? cashRef.current?.focus() : noteRef.current?.focus()
                }
                required
                returnKeyType="next"
                submitBehavior="submit"
                textContentType="name"
                value={receiverName}
              />
              {isCod ? (
                <FormField
                  error={formErrors.cashCollectedAmount}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                  keyboardType="decimal-pad"
                  label="Cash collected"
                  onChangeText={(value) =>
                    setCashCollectedAmount(
                      value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
                    )
                  }
                  onSubmitEditing={() => noteRef.current?.focus()}
                  ref={cashRef}
                  returnKeyType="next"
                  required
                  submitBehavior="submit"
                  value={cashCollectedAmount}
                />
              ) : null}
              <ActionButton
                icon="camera-outline"
                label={proofAsset ? "Proof selected" : "Capture proof"}
                onPress={async () => {
                  try {
                    const result = await pickProofImage();

                    if (result.status === "permission-denied") {
                      if (!result.canAskAgain) {
                        showPermissionSettingsAlert({
                          body: `Enable ${
                            result.source === "camera" ? "Camera" : "Photos"
                          } access in Settings to attach proof of delivery.`,
                          title: "Proof photo permission is off"
                        });
                      } else {
                        feedback.warning("Proof photo permission was not granted.");
                      }
                      return;
                    }

                    if (result.status === "selected") {
                      setProofAsset(result.asset);
                      setFormErrors((errors) => ({
                        ...errors,
                        proof: undefined
                      }));
                      feedback.success("Proof photo attached.", "Proof selected");
                    }
                  } catch (error) {
                    feedback.error(errorMessage(error));
                  }
                }}
                tone="secondary"
              />
              {formErrors.proof ? (
                <Text style={styles.errorText}>{formErrors.proof}</Text>
              ) : null}
              {proofAsset || assignment.proofOfDeliveryUrl ? (
                <Image
                  accessibilityLabel="Selected proof of delivery"
                  resizeMode="cover"
                  source={{
                    uri: proofAsset?.uri ?? assignment.proofOfDeliveryUrl ?? ""
                  }}
                  style={styles.proofImage}
                />
              ) : null}
            </>
          ) : null}

          {canFail || canCancel ? (
            <FormField
              error={formErrors.failureReason}
              label={canCancel ? "Cancellation reason" : "Failure reason"}
              multiline
              onChangeText={setFailureReason}
              returnKeyType="next"
              submitBehavior="newline"
              value={failureReason}
            />
          ) : null}

          <FormField
            label="Note"
            multiline
            onChangeText={setNote}
            ref={noteRef}
            returnKeyType="done"
            submitBehavior="newline"
            value={note}
          />
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
            disabled={Boolean(queuedForAssignment || submittingStatus)}
            loading={submittingStatus === status}
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

      {queuedUpdates.length > 0 && !queuedForAssignment ? (
        <View style={styles.queueBanner}>
          <Ionicons color="#92400E" name="cloud-offline-outline" size={18} />
          <Text style={styles.queueText}>
            {queuedUpdates.length} queued update
            {queuedUpdates.length === 1 ? "" : "s"} waiting to sync
          </Text>
        </View>
      ) : null}
      <KeyboardAccessory nativeID={KEYBOARD_ACCESSORY_ID} />
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
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "700"
  },
  detailInfoLabel: {
    color: "#64748B",
    fontFamily: fonts.bodySemiBold,
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
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  errorText: {
    color: "#B91C1C",
    fontFamily: fonts.bodySemiBold,
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
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20
  },
  itemName: {
    color: "#0F172A",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "800"
  },
  itemQty: {
    color: "#475569",
    fontFamily: fonts.bodySemiBold,
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
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "700"
  },
  itemText: {
    flex: 1,
    gap: 3
  },
  meta: {
    color: "#64748B",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "700"
  },
  noteText: {
    color: "#334155",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20
  },
  orderNumber: {
    color: "#0F172A",
    fontFamily: fonts.headingBold,
    fontSize: 21,
    fontWeight: "900"
  },
  proofImage: {
    aspectRatio: 4 / 3,
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    maxHeight: 360,
    width: "100%"
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
    fontFamily: fonts.bodySemiBold,
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
    fontFamily: fonts.headingBold,
    fontSize: 14,
    fontWeight: "900"
  },
  titleBlock: {
    flex: 1,
    gap: 5,
    minWidth: 0
  }
});
