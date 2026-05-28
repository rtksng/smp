import { describe, expect, it } from "vitest";
import {
  documentTypeLabel,
  getVisibleProductDocuments
} from "./product-documents";

describe("product document helpers", () => {
  it("keeps only customer-relevant product document types", () => {
    const documents = getVisibleProductDocuments([
      {
        fileKey: "catalog/products/certificate.pdf",
        fileUrl: "https://cdn.example.com/certificate.pdf",
        id: "certificate",
        title: "Sterility Certificate",
        type: "CERTIFICATE"
      },
      {
        fileKey: "catalog/products/manual.pdf",
        fileUrl: "https://cdn.example.com/manual.pdf",
        id: "manual",
        title: "User Manual",
        type: "MANUAL"
      },
      {
        fileKey: "catalog/products/safety.pdf",
        fileUrl: "https://cdn.example.com/safety.pdf",
        id: "safety",
        title: "Safety Sheet",
        type: "SAFETY_SHEET"
      }
    ]);

    expect(documents.map((document) => document.type)).toEqual([
      "CERTIFICATE",
      "MANUAL"
    ]);
  });

  it("returns display labels for supported document types", () => {
    expect(documentTypeLabel("CERTIFICATE")).toBe("Certificate");
    expect(documentTypeLabel("MANUAL")).toBe("Manual");
    expect(documentTypeLabel("WARRANTY")).toBe("Warranty document");
    expect(documentTypeLabel("COMPLIANCE")).toBe("Compliance document");
  });
});
