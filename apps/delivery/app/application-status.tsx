import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ActionButton } from "../components/ActionButton";
import { Screen } from "../components/Screen";
import { StatusPill } from "../components/StatusPill";
import { EmptyState, SectionCard } from "../components/ui/delivery-card";
import { errorMessage } from "../components/ui/feedback";
import { getDeliveryApplicationStatus } from "../lib/api/auth";
import type { DeliveryApplication } from "../lib/api/types";
import {
  clearStoredDeliveryApplication,
  getStoredDeliveryApplication,
  storeDeliveryApplication
} from "../lib/auth/application-store";
import { formatDateTime } from "../lib/delivery/dashboard";
import { fonts } from "../lib/theme";

export default function ApplicationStatusScreen() {
  const [application, setApplication] = useState<DeliveryApplication | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getStoredDeliveryApplication()
      .then(setApplication)
      .finally(() => setReady(true));
  }, []);

  const statusQuery = useQuery({
    enabled: Boolean(application?.id),
    queryFn: () => getDeliveryApplicationStatus(application?.id ?? ""),
    queryKey: ["delivery-application", application?.id]
  });
  const status = statusQuery.data?.status ?? application?.status;
  const reason = statusQuery.data?.statusReason ?? application?.statusReason ?? null;
  const updatedAt = statusQuery.data?.updatedAt ?? application?.updatedAt;

  useEffect(() => {
    if (!statusQuery.data) {
      return;
    }

    setApplication((current) => {
      if (!current) {
        return current;
      }

      const nextApplication = { ...current, ...statusQuery.data };
      void storeDeliveryApplication(nextApplication);
      return nextApplication;
    });
  }, [statusQuery.data]);

  if (!ready) {
    return (
      <Screen>
        <EmptyState icon="time-outline" title="Loading application" />
      </Screen>
    );
  }

  if (!application) {
    return (
      <Screen>
        <EmptyState
          icon="document-text-outline"
          message="Submit a partner application to track its approval status."
          title="No saved application"
        />
        <ActionButton label="Go to application" onPress={() => router.replace("/login")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionCard>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text selectable style={styles.name}>{application.fullName}</Text>
            <Text selectable style={styles.meta}>{application.mobileNumber}</Text>
          </View>
          {status ? <StatusPill status={status} /> : null}
        </View>
        <Text selectable style={styles.explanation}>{statusCopy(status)}</Text>
        {reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Review note</Text>
            <Text selectable style={styles.reasonText}>{reason}</Text>
          </View>
        ) : null}
        <Info label="Vehicle" value={application.vehicleNumber ?? "Not provided"} />
        <Info label="Email" value={application.email ?? "Not provided"} />
        <Info label="Updated" value={formatDateTime(updatedAt)} />
      </SectionCard>

      {statusQuery.isError ? (
        <Text selectable style={styles.error}>{errorMessage(statusQuery.error)}</Text>
      ) : null}

      <ActionButton
        icon="refresh-outline"
        label="Refresh status"
        loading={statusQuery.isFetching}
        onPress={() => void statusQuery.refetch()}
        tone="secondary"
      />
      {status === "ACTIVE" ? (
        <ActionButton
          icon="log-in-outline"
          label="Sign in with OTP"
          onPress={() => router.replace("/login")}
        />
      ) : null}
      {status === "INACTIVE" ? (
        <ActionButton
          icon="create-outline"
          label="Update and resubmit"
          onPress={() => {
            void clearStoredDeliveryApplication().then(() => router.replace("/login"));
          }}
          tone="secondary"
        />
      ) : null}
    </Screen>
  );
}

function statusCopy(status: DeliveryApplication["status"] | undefined) {
  switch (status) {
    case "ACTIVE":
      return "Your application is approved. You can now sign in with your registered mobile number.";
    case "INACTIVE":
      return "Your application needs changes before it can be approved.";
    case "SUSPENDED":
      return "Delivery access is suspended. Contact delivery operations for assistance.";
    default:
      return "Your application is under review. You will be able to sign in after approval.";
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    color: "#B91C1C",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "700"
  },
  explanation: {
    color: "#2B4946",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  infoLabel: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    fontWeight: "800",
    width: 74
  },
  infoRow: { flexDirection: "row", gap: 8 },
  infoValue: {
    color: "#123432",
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "700"
  },
  meta: {
    color: "#55716E",
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    fontWeight: "700"
  },
  name: {
    color: "#123432",
    fontFamily: fonts.headingBold,
    fontSize: 22,
    fontWeight: "900"
  },
  reasonBox: {
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    gap: 4,
    padding: 12
  },
  reasonLabel: {
    color: "#9A3412",
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  reasonText: {
    color: "#7C2D12",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20
  },
  titleBlock: { flex: 1, gap: 4 },
  topRow: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between" }
});
