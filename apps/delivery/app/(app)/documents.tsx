import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionButton } from "../../components/ActionButton";
import { Screen } from "../../components/Screen";
import { EmptyState, SectionCard } from "../../components/ui/delivery-card";
import { errorMessage, useAppFeedback } from "../../components/ui/feedback";
import {
  addPartnerDocument,
  getMyProfile,
  uploadPartnerDocument
} from "../../lib/api/delivery";
import { useAuth } from "../../lib/auth/auth-context";
import {
  pickPartnerDocumentImage,
  showPermissionSettingsAlert,
  type ProofImageAsset
} from "../../lib/device/native";
import { formatDateTime } from "../../lib/delivery/dashboard";
import { useState } from "react";

const DOCUMENT_TYPES = [
  ["DRIVING_LICENSE", "Driving licence"],
  ["ID_PROOF", "ID proof"],
  ["VEHICLE_REGISTRATION", "Vehicle registration"],
  ["OTHER", "Other"]
] as const;

export default function DocumentsScreen() {
  const { accessToken } = useAuth();
  const feedback = useAppFeedback();
  const queryClient = useQueryClient();
  const [type, setType] = useState<(typeof DOCUMENT_TYPES)[number][0]>(
    "DRIVING_LICENSE"
  );
  const [asset, setAsset] = useState<ProofImageAsset | null>(null);
  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getMyProfile(accessToken ?? ""),
    queryKey: ["delivery-profile"]
  });
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!asset) {
        throw new Error("Select or capture a document image first.");
      }

      const uploaded = await uploadPartnerDocument(accessToken ?? "", {
        name: asset.fileName,
        type: asset.mimeType,
        uri: asset.uri
      });
      const title = DOCUMENT_TYPES.find(([value]) => value === type)?.[1] ?? type;

      return addPartnerDocument(accessToken ?? "", {
        fileKey: uploaded.key,
        fileUrl: uploaded.url,
        title,
        type
      });
    },
    onError: (error) => feedback.error(errorMessage(error)),
    onSuccess: (profile) => {
      queryClient.setQueryData(["delivery-profile"], profile);
      setAsset(null);
      feedback.success("Document submitted for verification.");
    }
  });

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <EmptyState icon="documents-outline" title="Loading documents" />
      </Screen>
    );
  }

  const documents = profileQuery.data?.documents ?? [];

  return (
    <Screen>
      <SectionCard title="Submit document">
        <Text selectable style={styles.helper}>
          Upload a clear photo. Delivery operations will review each document and mark it verified.
        </Text>
        <View style={styles.types}>
          {DOCUMENT_TYPES.map(([value, label]) => {
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
        <ActionButton
          icon="camera-outline"
          label={asset ? "Change document image" : "Capture or choose image"}
          onPress={async () => {
            const result = await pickPartnerDocumentImage();

            if (result.status === "permission-denied") {
              if (!result.canAskAgain) {
                showPermissionSettingsAlert({
                  body: "Enable Camera or Photos access in Settings to upload partner documents.",
                  title: "Document permission is off"
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
            accessibilityLabel="Selected partner document"
            resizeMode="cover"
            source={{ uri: asset.uri }}
            style={styles.preview}
          />
        ) : null}
        <ActionButton
          disabled={!asset}
          icon="cloud-upload-outline"
          label="Submit for verification"
          loading={uploadMutation.isPending}
          onPress={() => uploadMutation.mutate()}
        />
      </SectionCard>

      <SectionCard title="Your documents">
        {documents.length === 0 ? (
          <Text style={styles.emptyText}>No documents submitted yet.</Text>
        ) : (
          documents.map((document) => (
            <View key={document.id} style={styles.documentRow}>
              <View style={styles.documentText}>
                <Text selectable style={styles.documentTitle}>{document.title}</Text>
                <Text selectable style={styles.documentMeta}>
                  Submitted {formatDateTime(document.createdAt)}
                </Text>
              </View>
              <Text style={document.verifiedAt ? styles.verified : styles.pending}>
                {document.verifiedAt ? "Verified" : "Pending"}
              </Text>
            </View>
          ))
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  documentMeta: { color: "#64748B", fontSize: 12, fontWeight: "700" },
  documentRow: { alignItems: "center", borderTopColor: "#E2E8F0", borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 8, minHeight: 58, paddingVertical: 8 },
  documentText: { flex: 1, gap: 3 },
  documentTitle: { color: "#0F172A", fontSize: 14, fontWeight: "900" },
  emptyText: { color: "#64748B", fontSize: 14, paddingVertical: 12, textAlign: "center" },
  helper: { color: "#475569", fontSize: 14, lineHeight: 20 },
  pending: { color: "#92400E", fontSize: 12, fontWeight: "900" },
  preview: { borderRadius: 10, height: 190, width: "100%" },
  type: { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1", borderRadius: 999, borderWidth: 1, minHeight: 44, paddingHorizontal: 12, paddingVertical: 11 },
  typeSelected: { backgroundColor: "#E8F5EC", borderColor: "#287C30" },
  typeText: { color: "#334155", fontSize: 13, fontWeight: "800" },
  typeTextSelected: { color: "#166534", fontSize: 13, fontWeight: "900" },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  verified: { color: "#166534", fontSize: 12, fontWeight: "900" }
});
