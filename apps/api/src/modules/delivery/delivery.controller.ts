import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { AuthTokenAudience } from "../auth/common/auth-token.service";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { DeliveryPartnerJwtGuard } from "../auth/guards/delivery-partner-jwt.guard";
import { DeliveryService } from "./delivery.service";
import {
  AddDeliveryPartnerDocumentDto,
  DeliveryAssignmentListQueryDto,
  DeliveryAssignmentListResponseDto,
  DeliveryAssignmentResponseDto,
  DeliveryPartnerDeviceDto,
  DeliveryPartnerLocationDto,
  DeliveryPartnerOnlineStatusDto,
  DeliveryPartnerResponseDto,
  UpdateDeliveryAssignmentStatusDto
} from "./dto/delivery.dto";

@ApiBearerAuth()
@ApiTags("Delivery partner mobile API")
@Controller("delivery")
@UseGuards(DeliveryPartnerJwtGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get("me")
  @ApiOperation({
    summary: "Get the authenticated delivery partner profile for the future mobile app."
  })
  @ApiOkResponse({
    description: "Delivery partner profile returned.",
    type: DeliveryPartnerResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  getMe(@Req() request: AuthenticatedRequest) {
    return this.deliveryService.getMyProfile(getDeliveryPartnerId(request));
  }

  @Patch("me/status")
  @ApiOperation({ summary: "Update delivery partner online/offline availability." })
  @ApiOkResponse({
    description: "Delivery partner availability updated.",
    type: DeliveryPartnerResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  updateMyStatus(
    @Body() body: DeliveryPartnerOnlineStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.updateMyOnlineStatus(
      getDeliveryPartnerId(request),
      body
    );
  }

  @Patch("me/device")
  @ApiOperation({ summary: "Register or update the native app push device token." })
  @ApiOkResponse({ description: "Delivery partner device token stored." })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  registerMyDevice(
    @Body() body: DeliveryPartnerDeviceDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.registerMyDevice(
      getDeliveryPartnerId(request),
      body
    );
  }

  @Post("me/location")
  @ApiOperation({ summary: "Update the delivery partner last known GPS location." })
  @ApiOkResponse({
    description: "Delivery partner location updated.",
    type: DeliveryPartnerResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  updateMyLocation(
    @Body() body: DeliveryPartnerLocationDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.updateMyLocation(
      getDeliveryPartnerId(request),
      body
    );
  }

  @Post("me/documents")
  @ApiOperation({
    summary: "Store uploaded delivery partner document metadata after upload."
  })
  @ApiCreatedResponse({
    description: "Document metadata stored on the profile.",
    type: DeliveryPartnerResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  addMyDocument(
    @Body() body: AddDeliveryPartnerDocumentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.addMyDocument(getDeliveryPartnerId(request), body);
  }

  @Get("assignments")
  @ApiOperation({ summary: "List assigned deliveries for the delivery partner." })
  @ApiOkResponse({
    description: "Delivery assignments returned.",
    type: DeliveryAssignmentListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  listAssignments(
    @Query() query: DeliveryAssignmentListQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.listMyAssignments(
      getDeliveryPartnerId(request),
      query
    );
  }

  @Patch("assignments/:id/status")
  @ApiOperation({ summary: "Update an assigned delivery status." })
  @ApiParam({
    example: "f5083366-53bb-4bd6-8c55-cbfc55f3a063",
    name: "id"
  })
  @ApiOkResponse({
    description: "Delivery assignment status updated.",
    type: DeliveryAssignmentResponseDto
  })
  @ApiBadRequestResponse({ description: "Requested status transition is invalid." })
  @ApiUnauthorizedResponse({ description: "Delivery partner access token is missing or invalid." })
  @ApiNotFoundResponse({ description: "Delivery assignment was not found." })
  updateAssignmentStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateDeliveryAssignmentStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.updateAssignmentStatus(
      getDeliveryPartnerId(request),
      id,
      body
    );
  }
}

function getDeliveryPartnerId(request: AuthenticatedRequest) {
  if (
    !request.auth ||
    request.auth.audience !== AuthTokenAudience.DeliveryPartner
  ) {
    throw new UnauthorizedException(
      "Delivery partner access token is missing or invalid."
    );
  }

  return request.auth.sub;
}
