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

        if (provider !== "local") {
          throw new Error("Only local upload storage is implemented.");
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
