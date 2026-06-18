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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import { AdminCustomersService } from "./admin-customers.service";
import {
  AddCustomerSupportNoteDto,
  AdminCustomerDetailResponseDto,
  AdminCustomerListQueryDto,
  AdminCustomerListResponseDto,
  AdminCustomerResponseDto,
  AdminCustomerSupportNoteResponseDto,
  UpdateCustomerStatusDto
} from "./dto/admin-customer.dto";

@ApiBearerAuth()
@ApiTags("Admin customers")
@Controller("admin/customers")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminCustomersController {
  constructor(private readonly adminCustomersService: AdminCustomersService) {}

  @Get()
  @RequirePermission(PermissionCode.UsersRead)
  @ApiOperation({ summary: "List customer records for admin support." })
  @ApiOkResponse({
    description: "Customer list returned.",
    type: AdminCustomerListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks users.read permission." })
  listCustomers(@Query() query: AdminCustomerListQueryDto) {
    return this.adminCustomersService.listCustomers(query);
  }

  @Get(":id")
  @RequirePermission(PermissionCode.UsersRead)
  @ApiOperation({ summary: "Get customer profile, addresses, orders, and notes." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Customer detail returned.",
    type: AdminCustomerDetailResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks users.read permission." })
  @ApiNotFoundResponse({ description: "Customer was not found." })
  getCustomer(@Param("id", ParseUUIDPipe) id: string) {
    return this.adminCustomersService.getCustomer(id);
  }

  @Patch(":id/status")
  @RequirePermission(PermissionCode.UsersUpdate)
  @ApiOperation({ summary: "Activate, deactivate, or block a customer account." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Customer status updated.",
    type: AdminCustomerResponseDto
  })
  @ApiBadRequestResponse({ description: "Status payload was invalid." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks users.update permission." })
  @ApiNotFoundResponse({ description: "Customer was not found." })
  updateCustomerStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateCustomerStatusDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.adminCustomersService.updateCustomerStatus(
      id,
      body,
      getAdminId(request)
    );
  }

  @Post(":id/notes")
  @RequirePermission(PermissionCode.UsersUpdate)
  @ApiOperation({ summary: "Add an internal support note to a customer account." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Support note created.",
    type: AdminCustomerSupportNoteResponseDto
  })
  @ApiBadRequestResponse({ description: "Note payload was invalid." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks users.update permission." })
  @ApiNotFoundResponse({ description: "Customer was not found." })
  addSupportNote(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AddCustomerSupportNoteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.adminCustomersService.addSupportNote(
      id,
      body,
      getAdminId(request)
    );
  }
}

function getAdminId(request: AuthenticatedRequest) {
  if (!request.auth?.sub) {
    throw new UnauthorizedException("Admin access token is missing or invalid.");
  }

  return request.auth.sub;
}
