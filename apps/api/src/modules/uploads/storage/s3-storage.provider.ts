import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import type {
  StorageProvider,
  StoragePutObjectInput,
  StoredObject
} from "./local-storage.provider";

export type S3StorageProviderOptions = {
  accessKeyId?: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  publicBaseUrl: string;
  region?: string;
  secretAccessKey?: string;
};

type S3ClientLike = {
  send(command: PutObjectCommand): Promise<unknown>;
};

export class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly client: S3ClientLike;
  private readonly publicBaseUrl: string;

  constructor(options: S3StorageProviderOptions, client?: S3ClientLike) {
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, "");
    this.client = client ?? new S3Client(buildS3ClientConfig(options));
  }

  async putObject(input: StoragePutObjectInput): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Body: input.buffer,
        Bucket: this.bucket,
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
