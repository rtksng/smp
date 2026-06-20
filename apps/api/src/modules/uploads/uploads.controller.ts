import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { CustomerJwtGuard } from "../auth/guards/customer-jwt.guard";
import { DeliveryPartnerJwtGuard } from "../auth/guards/delivery-partner-jwt.guard";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import {
  AdminUploadDocumentDto,
  CustomerUploadDocumentDto,
  DeliveryProofUploadDocumentDto,
  DeliveryPartnerUploadDocumentDto,
  UploadImageDto
} from "./dto/upload-request.dto";
import { UploadResponseDto } from "./dto/upload-response.dto";
import { UploadDocumentPurpose } from "./uploads.constants";
import {
  UploadedFilePayload,
  UploadsService
} from "./uploads.service";

const fileUploadSchema = {
  type: "object",
  properties: {
    entityId: {
      format: "uuid",
      type: "string"
    },
    file: {
      format: "binary",
      type: "string"
    },
    purpose: {
      type: "string"
    }
  },
  required: ["file", "purpose"]
};

@ApiBearerAuth()
@ApiTags("Uploads")
@Controller("uploads")
@UseGuards(AdminJwtGuard)
export class AdminUploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("image")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload an admin-managed catalog image."
  })
  @ApiBody({
    description: "Multipart upload for product images, brand logos, or category images.",
    schema: fileUploadSchema
  })
  @ApiCreatedResponse({
    description: "Image uploaded.",
    type: UploadResponseDto
  })
  @ApiBadRequestResponse({ description: "File type, extension, size, or payload is invalid." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  uploadImage(
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() body: UploadImageDto
  ) {
    return this.uploadsService.uploadImage(file, body);
  }

  @Post("document")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload an admin-managed product document."
  })
  @ApiBody({
    description: "Multipart upload for product manuals, certificates, warranties, or compliance documents.",
    schema: fileUploadSchema
  })
  @ApiCreatedResponse({
    description: "Document uploaded.",
    type: UploadResponseDto
  })
  @ApiBadRequestResponse({ description: "File type, extension, size, or payload is invalid." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  uploadDocument(
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() body: AdminUploadDocumentDto
  ) {
    return this.uploadsService.uploadDocument(file, body);
  }
}

@ApiBearerAuth()
@ApiTags("Customer uploads")
@Controller("customer/uploads")
@UseGuards(CustomerJwtGuard)
export class CustomerUploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("document")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload a customer-owned document."
  })
  @ApiBody({
    description: "Multipart upload for customer documents.",
    schema: {
      ...fileUploadSchema,
      required: ["file"]
    }
  })
  @ApiCreatedResponse({
    description: "Document uploaded.",
    type: UploadResponseDto
  })
  @ApiBadRequestResponse({ description: "File type, extension, size, or payload is invalid." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  uploadDocument(
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() _body: CustomerUploadDocumentDto
  ) {
    return this.uploadsService.uploadDocument(file, {
      purpose: UploadDocumentPurpose.CustomerDocument
    });
  }
}

@ApiBearerAuth()
@ApiTags("Delivery partner uploads")
@Controller("delivery-partner/uploads")
@UseGuards(DeliveryPartnerJwtGuard)
export class DeliveryPartnerUploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("document")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload a delivery partner-owned document."
  })
  @ApiBody({
    description: "Multipart upload for delivery partner documents.",
    schema: {
      ...fileUploadSchema,
      required: ["file"]
    }
  })
  @ApiCreatedResponse({
    description: "Document uploaded.",
    type: UploadResponseDto
  })
  @ApiBadRequestResponse({ description: "File type, extension, size, or payload is invalid." })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  uploadDocument(
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() _body: DeliveryPartnerUploadDocumentDto
  ) {
    return this.uploadsService.uploadDocument(file, {
      purpose: UploadDocumentPurpose.DeliveryPartnerDocument
    });
  }

  @Post("proof")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload delivery proof for a delivery assignment."
  })
  @ApiBody({
    description: "Multipart upload for delivery proof photos or signatures.",
    schema: {
      ...fileUploadSchema,
      required: ["file"]
    }
  })
  @ApiCreatedResponse({
    description: "Delivery proof uploaded.",
    type: UploadResponseDto
  })
  @ApiBadRequestResponse({ description: "File type, extension, size, or payload is invalid." })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  uploadProof(
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() _body: DeliveryProofUploadDocumentDto
  ) {
    return this.uploadsService.uploadDocument(file, {
      purpose: UploadDocumentPurpose.DeliveryProof
    });
  }
}
