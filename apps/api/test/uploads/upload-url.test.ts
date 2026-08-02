import "reflect-metadata";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resolveStoredUploadUrl } from "../../src/modules/uploads/upload-url";

const originalStoragePublicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL;
const originalStoragePublicPath = process.env.STORAGE_PUBLIC_PATH;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalStoragePublicBaseUrl === undefined) {
    delete process.env.STORAGE_PUBLIC_BASE_URL;
  } else {
    process.env.STORAGE_PUBLIC_BASE_URL = originalStoragePublicBaseUrl;
  }

  if (originalStoragePublicPath === undefined) {
    delete process.env.STORAGE_PUBLIC_PATH;
  } else {
    process.env.STORAGE_PUBLIC_PATH = originalStoragePublicPath;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("resolveStoredUploadUrl rewrites old absolute upload hosts to the current public base", () => {
  process.env.STORAGE_PUBLIC_BASE_URL =
    "https://api.example.com/uploads";

  assert.equal(
    resolveStoredUploadUrl(
      "https://old-service.up.railway.app/uploads/catalog/products/images/main.png"
    ),
    "https://api.example.com/uploads/catalog/products/images/main.png"
  );
});

test("resolveStoredUploadUrl keeps external non-upload URLs unchanged", () => {
  process.env.STORAGE_PUBLIC_BASE_URL =
    "https://api.example.com/uploads";

  assert.equal(
    resolveStoredUploadUrl("https://cdn.example.com/products/main.png"),
    "https://cdn.example.com/products/main.png"
  );
});

test("resolveStoredUploadUrl supports relative upload keys", () => {
  process.env.STORAGE_PUBLIC_BASE_URL =
    "https://api.example.com/uploads";

  assert.equal(
    resolveStoredUploadUrl("uploads/catalog/brands/logos/main.png"),
    "https://api.example.com/uploads/catalog/brands/logos/main.png"
  );
});

test("resolveStoredUploadUrl replaces Railway placeholder bases with the public storage host", () => {
  process.env.NODE_ENV = "production";
  process.env.STORAGE_PUBLIC_BASE_URL = "<UNKNOWN>";

  assert.equal(
    resolveStoredUploadUrl("<UNKNOWN>/catalog/products/images/product.png"),
    "https://pxseurailproxy-production-1f3a.up.railway.app/catalog/products/images/product.png"
  );
});
