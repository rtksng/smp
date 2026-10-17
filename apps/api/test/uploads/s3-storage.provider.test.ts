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

test("S3StorageProvider keeps private files in the private bucket and reads them back", async () => {
  const client = new FakeS3Client();
  const provider = new S3StorageProvider(
    {
      bucket: "public-catalog",
      private: { bucket: "private-documents" },
      publicBaseUrl: "https://cdn.example.com/uploads"
    },
    client
  );

  await provider.putObject({
    buffer: Buffer.from("%PDF-1.7"),
    contentType: "application/pdf",
    key: "private/customers/customer-1/documents/id.pdf"
  });
  await provider.putObject({
    buffer: Buffer.from("png"),
    contentType: "image/png",
    key: "catalog/products/images/main.png"
  });
  await provider.getObject("private/customers/customer-1/documents/id.pdf");

  const buckets = client.commands.map(
    (command) => (command as { input: { Bucket: string } }).input.Bucket
  );
  assert.deepEqual(buckets, ["private-documents", "public-catalog", "private-documents"]);
});

test("S3StorageProvider reports a missing object as null", async () => {
  const provider = new S3StorageProvider(
    { bucket: "public-catalog", publicBaseUrl: "https://cdn.example.com/uploads" },
    {
      send: async () => {
        throw Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" });
      }
    }
  );

  assert.equal(await provider.getObject("private/customers/c/documents/x.pdf"), null);
});

test("S3StorageProvider uses the private bucket's own credentials when it has them", async () => {
  const publicClient = new FakeS3Client();
  const privateClient = new FakeS3Client();
  const provider = new S3StorageProvider(
    {
      bucket: "public-catalog",
      private: { accessKeyId: "private-key", bucket: "private-documents", secretAccessKey: "private-secret" },
      publicBaseUrl: "https://cdn.example.com/uploads"
    },
    publicClient,
    privateClient
  );

  await provider.putObject({
    buffer: Buffer.from("%PDF-1.7"),
    contentType: "application/pdf",
    key: "private/delivery-partners/partner-1/documents/licence.pdf"
  });
  await provider.putObject({
    buffer: Buffer.from("png"),
    contentType: "image/png",
    key: "catalog/products/images/main.png"
  });
  await provider.getObject("private/delivery-partners/partner-1/documents/licence.pdf");

  assert.equal(privateClient.commands.length, 2);
  assert.equal(publicClient.commands.length, 1);
  assert.equal(
    (publicClient.commands[0] as { input: { Key: string } }).input.Key,
    "catalog/products/images/main.png"
  );
});
