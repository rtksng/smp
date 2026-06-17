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
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import { DeliveryChargesService } from "./delivery-charges.service";
import {
  AdminDeliveryChargeRuleListQueryDto,
  CreateDeliveryChargeRuleDto,
  DeliveryChargeRuleListResponseDto,
  DeliveryChargeRuleResponseDto,
  UpdateDeliveryChargeRuleDto
} from "./dto/delivery-charge.dto";

@ApiBearerAuth()
@ApiTags("Admin delivery charge rules")
@Controller("admin/delivery-charge-rules")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminDeliveryChargesController {
  constructor(private readonly deliveryChargesService: DeliveryChargesService) {}

  @Get()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "List configured delivery charge rules." })
  @ApiOkResponse({
    description: "Delivery charge rules returned.",
    type: DeliveryChargeRuleListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  listAdminRules(@Query() query: AdminDeliveryChargeRuleListQueryDto) {
    return this.deliveryChargesService.listAdminRules(query);
  }

  @Post()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Create a delivery charge rule." })
  @ApiCreatedResponse({
    description: "Delivery charge rule created.",
    type: DeliveryChargeRuleResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  createAdminRule(@Body() body: CreateDeliveryChargeRuleDto) {
    return this.deliveryChargesService.createAdminRule(body);
  }

  @Patch(":id")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Update a delivery charge rule." })
  @ApiOkResponse({
    description: "Delivery charge rule updated.",
    type: DeliveryChargeRuleResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  updateAdminRule(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateDeliveryChargeRuleDto
  ) {
    return this.deliveryChargesService.updateAdminRule(id, body);
  }

  @Delete(":id")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Archive a delivery charge rule." })
  @ApiOkResponse({
    description: "Delivery charge rule archived.",
    type: DeliveryChargeRuleResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  deleteAdminRule(@Param("id", ParseUUIDPipe) id: string) {
    return this.deliveryChargesService.deleteAdminRule(id);
  }
}
