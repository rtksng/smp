import "reflect-metadata";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { test } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Request, Response } from "express";
import { detectFileType } from "../../src/modules/uploads/file-type";
import { PrivateFilesController } from "../../src/modules/uploads/private-files.controller";
import {
  isOwnedPrivateKey,
  signPrivateFileUrl,
  verifyPrivateFileSignature
} from "../../src/modules/uploads/private-files";
import type { StorageProvider } from "../../src/modules/uploads/storage/local-storage.provider";
import { uploaderTracker } from "../../src/modules/uploads/upload-throttle";

const KEY = "private/delivery-partners/partner-1/proofs/proof.png";
const NOW = Date.parse("2026-10-18T10:07:00.000Z");

function linkParts(url: string) {
  const parsed = new URL(url);
  return {
    expires: parsed.searchParams.get("expires"),
    key: decodeURIComponent(parsed.pathname.replace("/api/v1/files/", "")),
    signature: parsed.searchParams.get("signature")
  };
}

test("file types are recognised from their bytes, not their names", () => {
  const cases: Array<[Buffer, string | null]> = [
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
    [Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]), "image/webp"],
    [Buffer.concat([Buffer.alloc(4), Buffer.from("ftypavif")]), "image/avif"],
    [Buffer.from("%PDF-1.7"), "application/pdf"],
    [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), "application/msword"],
    [
      Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml word/document.xml")]),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ],
    // A plain ZIP is not a Word document.
    [Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("payload.exe")]), null],
    [Buffer.from("<svg onload=alert(1)>"), null],
    [Buffer.from("<html><script>"), null],
    [Buffer.from("MZ executable"), null],
    [Buffer.alloc(0), null]
  ];

  for (const [bytes, expected] of cases) {
    assert.equal(detectFileType(bytes), expected, bytes.toString("latin1"));
  }
});

test("signed links verify only for the same file before they expire", () => {
  const { expires, key, signature } = linkParts(signPrivateFileUrl(KEY, NOW));

  assert.equal(key, KEY);
  assert.equal(verifyPrivateFileSignature(KEY, expires, signature, NOW), true);
  assert.equal(
    verifyPrivateFileSignature("private/delivery-partners/partner-2/proofs/proof.png", expires, signature, NOW),
    false
  );
  assert.equal(verifyPrivateFileSignature(KEY, Number(expires) + 900, signature, NOW), false);
  assert.equal(verifyPrivateFileSignature(KEY, expires, `${signature}x`, NOW), false);
  assert.equal(verifyPrivateFileSignature(KEY, expires, signature, Number(expires) * 1000 + 1), false);
});

test("links stay identical within a window so browsers can cache the file", () => {
  assert.equal(signPrivateFileUrl(KEY, NOW), signPrivateFileUrl(KEY, NOW + 60_000));
  const { expires } = linkParts(signPrivateFileUrl(KEY, NOW));
  const remainingMinutes = (Number(expires) * 1000 - NOW) / 60_000;
  assert.ok(remainingMinutes >= 15 && remainingMinutes <= 30, String(remainingMinutes));
});

test("a private key belongs only to the account whose folder it is in", () => {
  const partner = { id: "partner-1", kind: "delivery_partner" } as const;

  assert.equal(isOwnedPrivateKey(KEY, partner), true);
  assert.equal(isOwnedPrivateKey(KEY, { id: "partner-1", kind: "customer" }), false);
  assert.equal(isOwnedPrivateKey("private/delivery-partners/partner-10/proofs/x.png", partner), false);
  assert.equal(isOwnedPrivateKey("private/delivery-partners/partner-1/../partner-2/x.png", partner), false);
  assert.equal(isOwnedPrivateKey(undefined, partner), false);
});

function fakeResponse() {
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  const response = new Writable({
    write(chunk: Buffer, _encoding: string, done: () => void) {
      chunks.push(Buffer.from(chunk));
      done();
    }
  }) as Response & { body: () => string; headers: Record<string, string> };
  Object.assign(response, {
    body: () => Buffer.concat(chunks).toString(),
    headers,
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }
  });

  return response;
}

function controller(files: Record<string, string>) {
  const storage: StorageProvider = {
    getObject: async (key) =>
      files[key] === undefined ? null : { body: Readable.from([files[key]]), size: files[key].length },
    putObject: async () => {
      throw new Error("not used");
    }
  };

  return new PrivateFilesController(storage);
}

function fileRequest(key: string) {
  return { params: { 0: key } } as unknown as Request;
}

test("the files endpoint streams a file for a valid link", async () => {
  const { expires, signature } = linkParts(signPrivateFileUrl(KEY));
  const response = fakeResponse();

  await controller({ [KEY]: "png-bytes" }).download(fileRequest(KEY), expires ?? undefined, signature ?? undefined, response);

  assert.equal(response.body(), "png-bytes");
  assert.equal(response.headers["content-type"], "image/png");
  assert.equal(response.headers["content-disposition"], "inline");
  assert.match(response.headers["cache-control"] ?? "", /^private, max-age=\d+$/);
});

test("the files endpoint refuses bad links and reports missing files", async () => {
  const { expires, signature } = linkParts(signPrivateFileUrl(KEY));
  const files = controller({});
  const other = "private/delivery-partners/partner-2/proofs/proof.png";

  await assert.rejects(
    () => files.download(fileRequest(other), expires ?? undefined, signature ?? undefined, fakeResponse()),
    ForbiddenException
  );
  await assert.rejects(
    () => files.download(fileRequest(KEY), expires ?? undefined, undefined, fakeResponse()),
    ForbiddenException
  );
  await assert.rejects(
    () => files.download(fileRequest(KEY), expires ?? undefined, signature ?? undefined, fakeResponse()),
    NotFoundException
  );
});

test("uploads are limited per account, falling back to the IP without a token", () => {
  const payload = Buffer.from(JSON.stringify({ audience: "customer", sub: "customer-1" })).toString("base64url");

  assert.equal(
    uploaderTracker({ headers: { authorization: `Bearer header.${payload}.signature` }, ip: "203.0.113.7" }),
    "account:customer:customer-1"
  );
  assert.equal(uploaderTracker({ headers: {}, ip: "203.0.113.7" }), "203.0.113.7");
  assert.equal(
    uploaderTracker({ headers: { authorization: "Bearer not-a-jwt" }, ip: "203.0.113.7" }),
    "203.0.113.7"
  );
});
