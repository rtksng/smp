import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { PRIVATE_KEY_PREFIX } from "../private-files";
import type {
  StorageProvider,
  StoragePutObjectInput,
  StoredObject,
  StoredObjectStream
} from "./local-storage.provider";

export type S3BucketAccess = {
  accessKeyId?: string;
  endpoint?: string;
  region?: string;
  secretAccessKey?: string;
};

export type S3StorageProviderOptions = S3BucketAccess & {
  bucket: string;
  forcePathStyle?: boolean;
  // Bucket for customer and delivery partner files. Leave unset only when the
  // main bucket is not publicly readable; otherwise anyone who learns a key
  // could fetch the file through the public URL. Its credentials, endpoint and
  // region default to the main bucket's (Railway gives each bucket its own).
  private?: S3BucketAccess & { bucket: string };
  publicBaseUrl: string;
};

type S3ClientLike = {
  send(command: GetObjectCommand | PutObjectCommand): Promise<unknown>;
};

export class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly client: S3ClientLike;
  private readonly privateBucket: string;
  private readonly privateClient: S3ClientLike;
  private readonly publicBaseUrl: string;

  constructor(
    options: S3StorageProviderOptions,
    client?: S3ClientLike,
    privateClient?: S3ClientLike
  ) {
    this.bucket = options.bucket;
    this.privateBucket = options.private?.bucket || options.bucket;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, "");
    this.client = client ?? new S3Client(buildS3ClientConfig(options));
    this.privateClient =
      privateClient ??
      (options.private && hasOwnAccess(options.private)
        ? new S3Client(buildS3ClientConfig({ ...options, ...withoutUndefined(options.private) }))
        : this.client);
  }

  async getObject(key: string): Promise<StoredObjectStream | null> {
    try {
      const object = (await this.clientFor(key).send(
        new GetObjectCommand({ Bucket: this.bucketFor(key), Key: key })
      )) as { Body?: Readable; ContentLength?: number; ContentType?: string } | undefined;

      return object?.Body
        ? { body: object.Body, contentType: object.ContentType, size: object.ContentLength }
        : null;
    } catch (error) {
      if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) {
        return null;
      }

      throw error;
    }
  }

  async putObject(input: StoragePutObjectInput): Promise<StoredObject> {
    await this.clientFor(input.key).send(
      new PutObjectCommand({
        Body: input.buffer,
        Bucket: this.bucketFor(input.key),
        ContentType: input.contentType,
        Key: input.key
      })
    );

    return {
      key: input.key,
      mimeType: input.contentType,
      size: input.buffer.byteLength,
      url: `${this.publicBaseUrl}/${input.key}`
    };
  }

  private bucketFor(key: string) {
    return key.startsWith(PRIVATE_KEY_PREFIX) ? this.privateBucket : this.bucket;
  }

  private clientFor(key: string) {
    return key.startsWith(PRIVATE_KEY_PREFIX) ? this.privateClient : this.client;
  }
}

function hasOwnAccess(access: S3BucketAccess) {
  return Boolean(access.accessKeyId || access.endpoint || access.region);
}

function withoutUndefined<T extends object>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== "")
  ) as Partial<T>;
}

function buildS3ClientConfig(
  options: S3StorageProviderOptions
): S3ClientConfig {
  const config: S3ClientConfig = {
    endpoint: options.endpoint || undefined,
    forcePathStyle: options.forcePathStyle,
    region: options.region
  };

  if (options.accessKeyId && options.secretAccessKey) {
    config.credentials = {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey
    };
  }

  return config;
}
