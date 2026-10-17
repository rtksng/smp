import "reflect-metadata";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  LocalStorageProvider,
  type StorageProvider
} from "../../src/modules/uploads/storage/local-storage.provider";
import {
  UploadDocumentPurpose,
  UploadImagePurpose
} from "../../src/modules/uploads/uploads.constants";
import { UploadsService } from "../../src/modules/uploads/uploads.service";

type UploadedFileFixture = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

// Real leading bytes, because uploads are checked against their content.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const PDF_BYTES = Buffer.from("%PDF-1.7 test");

class MemoryStorageProvider implements StorageProvider {
  public stored: {
    buffer: Buffer;
    contentType: string;
    key: string;
  }[] = [];

  async getObject() {
    return null;
  }

  async putObject(input: {
    buffer: Buffer;
    contentType: string;
    key: string;
  }) {
    this.stored.push(input);

    return {
      key: input.key,
      mimeType: input.contentType,
      size: input.buffer.byteLength,
      url: `http://localhost:4000/uploads/${input.key}`
    };
  }
}

function fileFixture(
  input: Partial<UploadedFileFixture> = {}
): UploadedFileFixture {
  const buffer = input.buffer ?? PNG_BYTES;

  return {
    buffer,
    mimetype: "image/png",
    originalname: "main.png",
    size: buffer.byteLength,
    ...input
  };
}

test("uploadImage stores validated product images and returns file metadata", async () => {
  const storage = new MemoryStorageProvider();
  const service = new UploadsService(storage, {
    documentMaxBytes: 10 * 1024 * 1024,
    imageMaxBytes: 5 * 1024 * 1024
  });

  const result = await service.uploadImage(fileFixture(), {
    purpose: UploadImagePurpose.ProductImage
  });

  assert.equal(result.mimeType, "image/png");
  assert.equal(result.size, 10);
  assert.equal(
    result.url,
    `http://localhost:4000/uploads/${result.key}`
  );
  assert.match(result.key, /^catalog\/products\/images\/[a-f0-9-]+\.png$/);
  assert.deepEqual(storage.stored[0], {
    buffer: PNG_BYTES,
    contentType: "image/png",
    key: result.key
  });
});

test("uploadImage rejects unsupported image mime types", async () => {
  const service = new UploadsService(new MemoryStorageProvider(), {
    documentMaxBytes: 10 * 1024 * 1024,
    imageMaxBytes: 5 * 1024 * 1024
  });

  await assert.rejects(
    () =>
      service.uploadImage(
        fileFixture({
          mimetype: "image/gif",
          originalname: "animation.gif"
        }),
        { purpose: UploadImagePurpose.BrandLogo }
      ),
    BadRequestException
  );
});

test("uploadDocument rejects documents larger than the configured limit", async () => {
  const service = new UploadsService(new MemoryStorageProvider(), {
    documentMaxBytes: 4,
    imageMaxBytes: 5 * 1024 * 1024
  });

  await assert.rejects(
    () =>
      service.uploadDocument(
        fileFixture({
          buffer: Buffer.from("too-large"),
          mimetype: "application/pdf",
          originalname: "manual.pdf",
          size: 9
        }),
        { purpose: UploadDocumentPurpose.ProductDocument }
      ),
    BadRequestException
  );
});

test("private uploads go under the owner's folder and return a signed link, not a public URL", async () => {
  const storage = new MemoryStorageProvider();
  const service = new UploadsService(storage, {
    documentMaxBytes: 10 * 1024 * 1024,
    imageMaxBytes: 5 * 1024 * 1024
  });

  const proof = await service.uploadPrivateFile(fileFixture(), {
    owner: { id: "partner-1", kind: "delivery_partner" },
    purpose: UploadDocumentPurpose.DeliveryProof
  });
  const document = await service.uploadPrivateFile(
    fileFixture({ buffer: PDF_BYTES, mimetype: "application/pdf", originalname: "id.pdf" }),
    { owner: { id: "customer-1", kind: "customer" }, purpose: UploadDocumentPurpose.CustomerDocument }
  );

  assert.match(proof.key, /^private\/delivery-partners\/partner-1\/proofs\/[a-f0-9-]+\.png$/);
  assert.match(document.key, /^private\/customers\/customer-1\/documents\/[a-f0-9-]+\.pdf$/);
  assert.match(proof.url, /\/api\/v1\/files\/private\/delivery-partners\/partner-1\/proofs\/.+\?expires=\d+&signature=/);
  assert.doesNotMatch(proof.url, /\/uploads\//);
});

test("uploads are rejected when the bytes do not match the declared type", async () => {
  const service = new UploadsService(new MemoryStorageProvider(), {
    documentMaxBytes: 10 * 1024 * 1024,
    imageMaxBytes: 5 * 1024 * 1024
  });

  // A script renamed to .png, and a PNG claiming to be a PDF.
  await assert.rejects(
    () =>
      service.uploadImage(fileFixture({ buffer: Buffer.from("<script>alert(1)</script>") }), {
        purpose: UploadImagePurpose.ProductImage
      }),
    /does not match its file type/
  );
  await assert.rejects(
    () =>
      service.uploadDocument(
        fileFixture({ mimetype: "application/pdf", originalname: "manual.pdf" }),
        { purpose: UploadDocumentPurpose.ProductDocument }
      ),
    /does not match its file type/
  );
});

test("local storage provider writes files under the configured root", async () => {
  const root = await mkdtemp(join(tmpdir(), "smep-uploads-"));
  const provider = new LocalStorageProvider({
    localRoot: root,
    publicBaseUrl: "http://localhost:4000/uploads"
  });

  try {
    const result = await provider.putObject({
      buffer: Buffer.from("certificate"),
      contentType: "application/pdf",
      key: "catalog/products/documents/certificate.pdf"
    });

    assert.deepEqual(result, {
      key: "catalog/products/documents/certificate.pdf",
      mimeType: "application/pdf",
      size: 11,
      url: "http://localhost:4000/uploads/catalog/products/documents/certificate.pdf"
    });
    assert.equal(
      await readFile(
        join(root, "catalog", "products", "documents", "certificate.pdf"),
        "utf8"
      ),
      "certificate"
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
