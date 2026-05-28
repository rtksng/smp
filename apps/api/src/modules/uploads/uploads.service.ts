import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  STORAGE_PROVIDER,
  UPLOAD_OPTIONS,
  UploadDocumentPurpose,
  UploadImagePurpose
} from "./uploads.constants";
import type {
  StorageProvider,
  StoredObject
} from "./storage/local-storage.provider";

type AllowedMimeTypes = Record<string, string[]>;

const IMAGE_MIME_TYPES: AllowedMimeTypes = {
  "image/avif": [".avif"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};

const DOCUMENT_MIME_TYPES: AllowedMimeTypes = {
  "application/msword": [".doc"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx"
  ],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};

export type UploadsServiceOptions = {
  documentMaxBytes: number;
  imageMaxBytes: number;
};

export type UploadedFilePayload = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type UploadImageInput = {
  entityId?: string;
  purpose: UploadImagePurpose;
};

export type UploadDocumentInput = {
  entityId?: string;
  purpose: UploadDocumentPurpose;
};

@Injectable()
export class UploadsService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    @Inject(UPLOAD_OPTIONS) private readonly options: UploadsServiceOptions
  ) {}

  async uploadImage(
    file: UploadedFilePayload | undefined,
    input: UploadImageInput
  ): Promise<StoredObject> {
    const validated = this.validateFile(file, {
      allowedMimeTypes: IMAGE_MIME_TYPES,
      maxBytes: this.options.imageMaxBytes
    });

    return this.storageProvider.putObject({
      buffer: validated.file.buffer,
      contentType: validated.file.mimetype,
      key: this.buildKey(this.imageFolder(input.purpose), validated.extension)
    });
  }

  async uploadDocument(
    file: UploadedFilePayload | undefined,
    input: UploadDocumentInput
  ): Promise<StoredObject> {
    const validated = this.validateFile(file, {
      allowedMimeTypes: DOCUMENT_MIME_TYPES,
      maxBytes: this.options.documentMaxBytes
    });

    return this.storageProvider.putObject({
      buffer: validated.file.buffer,
      contentType: validated.file.mimetype,
      key: this.buildKey(this.documentFolder(input.purpose), validated.extension)
    });
  }

  private validateFile(
    file: UploadedFilePayload | undefined,
    options: {
      allowedMimeTypes: AllowedMimeTypes;
      maxBytes: number;
    }
  ): { extension: string; file: UploadedFilePayload } {
    if (!file?.buffer || !file.originalname || !file.mimetype) {
      throw new BadRequestException("A file is required.");
    }

    const allowedExtensions = options.allowedMimeTypes[file.mimetype];

    if (!allowedExtensions) {
      throw new BadRequestException("Unsupported file type.");
    }

    const extension = extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException("File extension does not match file type.");
    }

    const canonicalExtension = allowedExtensions[0];

    if (!canonicalExtension) {
      throw new BadRequestException("Unsupported file type.");
    }

    const actualSize = Math.max(file.size, file.buffer.byteLength);

    if (actualSize > options.maxBytes) {
      throw new BadRequestException("File exceeds the maximum allowed size.");
    }

    return {
      extension: canonicalExtension,
      file
    };
  }

  private buildKey(folder: string, extension: string) {
    return `${folder}/${randomUUID()}${extension}`;
  }

  private imageFolder(purpose: UploadImagePurpose) {
    switch (purpose) {
      case UploadImagePurpose.BrandLogo:
        return "catalog/brands/logos";
      case UploadImagePurpose.CategoryImage:
        return "catalog/categories/images";
      case UploadImagePurpose.ProductImage:
        return "catalog/products/images";
    }
  }

  private documentFolder(purpose: UploadDocumentPurpose) {
    switch (purpose) {
      case UploadDocumentPurpose.CustomerDocument:
        return "customers/documents";
      case UploadDocumentPurpose.DeliveryPartnerDocument:
        return "delivery-partners/documents";
      case UploadDocumentPurpose.ProductDocument:
        return "catalog/products/documents";
    }
  }
}
