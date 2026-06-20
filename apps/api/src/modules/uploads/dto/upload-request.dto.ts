import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsUUID } from "class-validator";
import {
  UploadDocumentPurpose,
  UploadImagePurpose
} from "../uploads.constants";

export class UploadImageDto {
  @ApiProperty({
    enum: UploadImagePurpose,
    example: UploadImagePurpose.ProductImage
  })
  @IsEnum(UploadImagePurpose)
  purpose!: UploadImagePurpose;

  @ApiPropertyOptional({
    description: "Optional owning record id used by clients when known.",
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;
}

export class AdminUploadDocumentDto {
  @ApiProperty({
    enum: [UploadDocumentPurpose.ProductDocument],
    example: UploadDocumentPurpose.ProductDocument
  })
  @IsIn([UploadDocumentPurpose.ProductDocument])
  purpose!: UploadDocumentPurpose.ProductDocument;

  @ApiPropertyOptional({
    description: "Optional product id used by clients when known.",
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsOptional()
  @IsUUID()
  entityId?: string;
}

export class CustomerUploadDocumentDto {
  @ApiPropertyOptional({
    enum: [UploadDocumentPurpose.CustomerDocument],
    example: UploadDocumentPurpose.CustomerDocument
  })
  @IsOptional()
  @IsIn([UploadDocumentPurpose.CustomerDocument])
  purpose?: UploadDocumentPurpose.CustomerDocument;
}

export class DeliveryPartnerUploadDocumentDto {
  @ApiPropertyOptional({
    enum: [UploadDocumentPurpose.DeliveryPartnerDocument],
    example: UploadDocumentPurpose.DeliveryPartnerDocument
  })
  @IsOptional()
  @IsIn([UploadDocumentPurpose.DeliveryPartnerDocument])
  purpose?: UploadDocumentPurpose.DeliveryPartnerDocument;
}

export class DeliveryProofUploadDocumentDto {
  @ApiPropertyOptional({
    enum: [UploadDocumentPurpose.DeliveryProof],
    example: UploadDocumentPurpose.DeliveryProof
  })
  @IsOptional()
  @IsIn([UploadDocumentPurpose.DeliveryProof])
  purpose?: UploadDocumentPurpose.DeliveryProof;
}
