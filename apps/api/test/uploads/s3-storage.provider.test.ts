import assert from "node:assert/strict";
import { test } from "node:test";
import { S3StorageProvider } from "../../src/modules/uploads/storage/s3-storage.provider";

class FakeS3Client {
  readonly commands: unknown[] = [];

  async send(command: unknown) {
    this.commands.push(command);
  }
}

test("S3StorageProvider stores objects through an S3-compatible client", async () => {
  const client = new FakeS3Client();
  const provider = new S3StorageProvider(
    {
      bucket: "surgical-prod-uploads",
      publicBaseUrl: "https://cdn.example.com/uploads"
    },
    client
  );

  const result = await provider.putObject({
    buffer: Buffer.from("certificate"),
    contentType: "application/pdf",
    key: "catalog/products/documents/certificate.pdf"
  });

  assert.deepEqual(result, {
    key: "catalog/products/documents/certificate.pdf",
    mimeType: "application/pdf",
    size: 11,
    url: "https://cdn.example.com/uploads/catalog/products/documents/certificate.pdf"
  });
  assert.equal(client.commands.length, 1);
  assert.equal(
    (client.commands[0] as { input: { Bucket: string } }).input.Bucket,
    "surgical-prod-uploads"
  );
  assert.equal(
    (client.commands[0] as { input: { Key: string } }).input.Key,
    "catalog/products/documents/certificate.pdf"
  );
  assert.equal(
    (client.commands[0] as { input: { ContentType: string } }).input.ContentType,
    "application/pdf"
  );
});
