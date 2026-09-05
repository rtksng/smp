import { afterEach, expect, test, vi } from "vitest";

vi.mock("expo-file-system", () => ({
  File: class extends Blob {
    constructor(readonly uri: string) {
      super(["sample image bytes"], { type: "image/jpeg" });
    }
  }
}));
vi.mock("./client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "./client";
import { uploadDeliveryProof, uploadPartnerDocument } from "./delivery";

afterEach(() => vi.clearAllMocks());

test.each([
  [uploadDeliveryProof, "/delivery-partner/uploads/proof"],
  [uploadPartnerDocument, "/delivery-partner/uploads/document"]
] as const)("uploads readable file bytes through %s", async (upload, path) => {
  upload("synthetic-test-token", {
    uri: "file:///qa/image.jpg", name: "proof.jpg", type: "image/jpeg"
  });
  const [actualPath, , options] = vi.mocked(apiRequest).mock.calls[0]!;
  expect(actualPath).toBe(path);
  expect(options).toMatchObject({ method: "POST", accessToken: "synthetic-test-token" });
  const file = (options!.body as FormData).get("file") as File;
  expect(file.name).toBe("proof.jpg");
  expect(file.type).toBe("image/jpeg");
  expect(await file.text()).toBe("sample image bytes");
});
