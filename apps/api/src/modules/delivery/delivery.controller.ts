import {
  Body,
  Controller,
  Delete,
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
  CreateDeliveryIncidentDto,
  DeliveryAssignmentListQueryDto,
  DeliveryAssignmentListResponseDto,
  DeliveryAssignmentResponseDto,
  DeliveryCashSummaryResponseDto,
  DeliveryDashboardResponseDto,
  DeliveryIncidentResponseDto,
  DeliveryNotificationListResponseDto,
  DeliveryNotificationResponseDto,
  DeliveryPartnerDeviceDto,
  DeliveryPartnerLocationDto,
  DeliveryPartnerOnlineStatusDto,
  DeliveryPartnerResponseDto,
  UpdateDeliveryAssignmentStatusDto,
  UpdateDeliveryPartnerProfileDto
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

  @Delete("me/devices")
  @ApiOperation({ summary: "Revoke registered delivery push devices." })
  @ApiOkResponse({ description: "Delivery push devices revoked." })
  revokeMyDevices(@Req() request: AuthenticatedRequest) {
    return this.deliveryService.revokeMyDevices(getDeliveryPartnerId(request));
  }

  @Patch("me")
  @ApiOperation({ summary: "Update delivery partner contact and vehicle details." })
  @ApiOkResponse({ type: DeliveryPartnerResponseDto })
  updateMe(
    @Body() body: UpdateDeliveryPartnerProfileDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.updateMyProfile(
      getDeliveryPartnerId(request),
      body
    );
  }

  @Get("dashboard")
  @ApiOperation({ summary: "Get complete delivery workload metrics." })
  @ApiOkResponse({ type: DeliveryDashboardResponseDto })
  getDashboard(@Req() request: AuthenticatedRequest) {
    return this.deliveryService.getMyDashboard(getDeliveryPartnerId(request));
  }

  @Get("cash")
  @ApiOperation({ summary: "Get COD accountability and earnings summary." })
  @ApiOkResponse({ type: DeliveryCashSummaryResponseDto })
  getCashSummary(@Req() request: AuthenticatedRequest) {
    return this.deliveryService.getMyCashSummary(getDeliveryPartnerId(request));
  }

  @Get("notifications")
  @ApiOperation({ summary: "List delivery partner notifications." })
  @ApiOkResponse({ type: DeliveryNotificationListResponseDto })
  listNotifications(@Req() request: AuthenticatedRequest) {
    return this.deliveryService.listMyNotifications(getDeliveryPartnerId(request));
  }

  @Patch("notifications/read-all")
  @ApiOperation({ summary: "Mark all delivery partner notifications read." })
  @ApiOkResponse({ description: "Notifications marked read." })
  markAllNotificationsRead(@Req() request: AuthenticatedRequest) {
    return this.deliveryService.markAllMyNotificationsRead(
      getDeliveryPartnerId(request)
    );
  }

  @Patch("notifications/:id/read")
  @ApiOperation({ summary: "Mark one delivery partner notification read." })
  @ApiOkResponse({ type: DeliveryNotificationResponseDto })
  markNotificationRead(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.markMyNotificationRead(
      getDeliveryPartnerId(request),
      id
    );
  }

  @Get("incidents")
  @ApiOperation({ summary: "List incidents reported by the delivery partner." })
  @ApiOkResponse({ description: "Delivery incidents returned." })
  listIncidents(@Req() request: AuthenticatedRequest) {
    return this.deliveryService.listMyIncidents(getDeliveryPartnerId(request));
  }

  @Get("support")
  @ApiOperation({ summary: "Get configured delivery operations support contacts." })
  @ApiOkResponse({ description: "Delivery support contact returned." })
  getSupport() {
    return this.deliveryService.getSupportContact();
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

  @Get("assignments/:id")
  @ApiOperation({ summary: "Get one assigned delivery for a reliable deep link." })
  @ApiOkResponse({ type: DeliveryAssignmentResponseDto })
  @ApiNotFoundResponse({ description: "Delivery assignment was not found." })
  getAssignment(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.getMyAssignment(
      getDeliveryPartnerId(request),
      id
    );
  }

  @Post("assignments/:id/incidents")
  @ApiOperation({ summary: "Report an operational incident for an assignment." })
  @ApiCreatedResponse({ type: DeliveryIncidentResponseDto })
  createIncident(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: CreateDeliveryIncidentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.deliveryService.createMyIncident(
      getDeliveryPartnerId(request),
      id,
      body
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
