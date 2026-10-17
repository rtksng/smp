import { pipeline } from "node:stream/promises";
import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Query,
  Req,
  Res
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { verifyPrivateFileSignature } from "./private-files";
import type { StorageProvider } from "./storage/local-storage.provider";
import { STORAGE_PROVIDER } from "./uploads.constants";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp"
};

// Serves files behind links from signPrivateFileUrl. The link itself is the
// authorization, so images and PDFs open directly in the dashboard and apps.
@ApiTags("Files")
@Controller("files")
export class PrivateFilesController {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  @Get("*")
  // A dashboard page can load many document thumbnails at once.
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiOperation({ summary: "Download a customer or delivery partner file through a signed link." })
  async download(
    @Req() request: Request,
    @Query("expires") expires: string | undefined,
    @Query("signature") signature: string | undefined,
    @Res() response: Response
  ) {
    const key = String((request.params as Record<string, string>)[0] ?? "");

    if (!key || key.includes("..") || !verifyPrivateFileSignature(key, expires, signature)) {
      throw new ForbiddenException("This file link is invalid or has expired.");
    }

    const file = await this.storage.getObject(key);

    if (!file) {
      throw new NotFoundException("File was not found.");
    }

    const extension = key.slice(key.lastIndexOf(".")).toLowerCase();
    const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
    const viewable = contentType.startsWith("image/") || contentType === "application/pdf";

    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Disposition", viewable ? "inline" : "attachment");
    response.setHeader(
      "Cache-Control",
      `private, max-age=${Math.max(0, Number(expires) - Math.floor(Date.now() / 1000))}`
    );
    if (file.size !== undefined) {
      response.setHeader("Content-Length", String(file.size));
    }

    await pipeline(file.body, response).catch(() => response.destroy());
  }
}
