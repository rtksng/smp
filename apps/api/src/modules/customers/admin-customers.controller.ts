import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import { AdminCustomersService } from "./admin-customers.service";
import {
  AdminCustomerListQueryDto,
  AdminCustomerListResponseDto
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
}
