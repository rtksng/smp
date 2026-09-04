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
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { CustomerJwtGuard } from "../auth/guards/customer-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import { CouponsService } from "./coupons.service";
import {
  AdminCouponListQueryDto,
  AvailableCouponListResponseDto,
  CouponListResponseDto,
  CouponResponseDto,
  CouponValidationResponseDto,
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto
} from "./dto/coupon.dto";

@ApiBearerAuth()
@ApiTags("Coupons")
@Controller("coupons")
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get("available")
  @UseGuards(CustomerJwtGuard)
  @ApiOperation({ summary: "List up to 100 currently available checkout coupons." })
  @ApiOkResponse({
    description: "Available coupons returned. Cart minimums are checked when applying a code.",
    type: AvailableCouponListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  listAvailableCoupons() {
    return this.couponsService.listAvailableCoupons();
  }

  @Post("validate")
  @UseGuards(CustomerJwtGuard)
  @ApiOperation({ summary: "Validate a coupon against the customer cart." })
  @ApiOkResponse({
    description: "Coupon discount preview returned.",
    type: CouponValidationResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  validateCoupon(
    @Body() body: ValidateCouponDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.couponsService.validateForCustomerCart(
      getCustomerId(request),
      body
    );
  }
}

@ApiBearerAuth()
@ApiTags("Admin coupons")
@Controller("admin/coupons")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "List configured coupons for admin review." })
  @ApiOkResponse({
    description: "Coupons returned.",
    type: CouponListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  listAdminCoupons(@Query() query: AdminCouponListQueryDto) {
    return this.couponsService.listAdminCoupons(query);
  }

  @Post()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Create a coupon for customer checkout." })
  @ApiCreatedResponse({
    description: "Coupon created.",
    type: CouponResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  createAdminCoupon(@Body() body: CreateCouponDto) {
    return this.couponsService.createAdminCoupon(body);
  }

  @Patch(":id")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Update a coupon." })
  @ApiOkResponse({
    description: "Coupon updated.",
    type: CouponResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  updateAdminCoupon(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateCouponDto
  ) {
    return this.couponsService.updateAdminCoupon(id, body);
  }

  @Delete(":id")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Archive a coupon." })
  @ApiOkResponse({
    description: "Coupon archived.",
    type: CouponResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  deleteAdminCoupon(@Param("id", ParseUUIDPipe) id: string) {
    return this.couponsService.deleteAdminCoupon(id);
  }
}

function getCustomerId(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Customer access token is missing or invalid.");
  }

  return request.auth.sub;
}
