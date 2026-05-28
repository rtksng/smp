import { dirname, resolve, sep } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

export type StorageProviderOptions = {
  localRoot: string;
  publicBaseUrl: string;
};

export type StoragePutObjectInput = {
  buffer: Buffer;
  contentType: string;
  key: string;
};

export type StoredObject = {
  key: string;
  mimeType: string;
  size: number;
  url: string;
};

export interface StorageProvider {
  putObject(input: StoragePutObjectInput): Promise<StoredObject>;
}

export class LocalStorageProvider implements StorageProvider {
  private readonly localRoot: string;
  private readonly publicBaseUrl: string;

  constructor(options: StorageProviderOptions) {
    this.localRoot = resolve(options.localRoot);
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, "");
  }

  async putObject(input: StoragePutObjectInput): Promise<StoredObject> {
    const targetPath = this.resolveKey(input.key);

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, input.buffer);

    return {
      key: input.key,
      mimeType: input.contentType,
      size: input.buffer.byteLength,
      url: `${this.publicBaseUrl}/${input.key}`
    };
  }

  private resolveKey(key: string) {
    const segments = key.split("/").filter(Boolean);
    const targetPath = resolve(this.localRoot, ...segments);
    const normalizedRoot = this.localRoot.toLowerCase();
    const normalizedTarget = targetPath.toLowerCase();

    if (
      normalizedTarget !== normalizedRoot &&
      !normalizedTarget.startsWith(`${normalizedRoot}${sep}`)
    ) {
      throw new Error("Invalid storage key.");
    }

    return targetPath;
  }
}
