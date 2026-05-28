import type { ProductDocument } from "../api/schemas";

const visibleDocumentTypes = new Set([
  "CERTIFICATE",
  "MANUAL",
  "WARRANTY",
  "COMPLIANCE"
]);

const documentLabels: Record<string, string> = {
  CERTIFICATE: "Certificate",
  COMPLIANCE: "Compliance document",
  MANUAL: "Manual",
  WARRANTY: "Warranty document"
};

export function getVisibleProductDocuments(documents: ProductDocument[]) {
  return documents.filter((document) => visibleDocumentTypes.has(document.type));
}

export function documentTypeLabel(type: string) {
  return documentLabels[type] ?? "Product document";
}
