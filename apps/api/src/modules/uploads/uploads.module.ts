import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import {
  DOCUMENT_MAX_BYTES_DEFAULT,
  IMAGE_MAX_BYTES_DEFAULT,
  STORAGE_PROVIDER,
  UPLOAD_OPTIONS
} from "./uploads.constants";
import { LocalStorageProvider } from "./storage/local-storage.provider";
import { S3StorageProvider } from "./storage/s3-storage.provider";
import {
  AdminUploadsController,
  CustomerUploadsController,
  DeliveryPartnerUploadsController
} from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  controllers: [
    AdminUploadsController,
    CustomerUploadsController,
    DeliveryPartnerUploadsController
  ],
  imports: [AuthModule],
  providers: [
    {
      inject: [ConfigService],
      provide: UPLOAD_OPTIONS,
      useFactory: (configService: ConfigService) => ({
        documentMaxBytes: configService.get<number>(
          "storageDocumentMaxBytes",
          DOCUMENT_MAX_BYTES_DEFAULT
        ),
        imageMaxBytes: configService.get<number>(
          "storageImageMaxBytes",
          IMAGE_MAX_BYTES_DEFAULT
        )
      })
    },
    {
      inject: [ConfigService],
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>("storageProvider", "local");

        if (provider === "s3") {
          return new S3StorageProvider({
            accessKeyId: configService.get<string>("s3AccessKeyId"),
            bucket: requiredConfig(configService, "s3Bucket"),
            endpoint: configService.get<string>("s3Endpoint") || undefined,
            forcePathStyle: configService.get<boolean>("s3ForcePathStyle", false),
            publicBaseUrl: requiredConfig(configService, "storagePublicBaseUrl"),
            region: requiredConfig(configService, "s3Region"),
            secretAccessKey: configService.get<string>("s3SecretAccessKey")
          });
        }

        if (provider !== "local") {
          throw new Error(`Unsupported upload storage provider: ${provider}.`);
        }

        return new LocalStorageProvider({
          localRoot: resolve(
            configService.get<string>("storageLocalRoot", "storage/uploads")
          ),
          publicBaseUrl: configService.get<string>(
            "storagePublicBaseUrl",
            "http://localhost:4000/uploads"
          )
        });
      }
    },
    UploadsService
  ],
  exports: [UploadsService]
})
export class UploadsModule {}

function requiredConfig(configService: ConfigService, key: string) {
  const value = configService.get<string>(key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}
