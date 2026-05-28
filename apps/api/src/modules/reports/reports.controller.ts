import { Controller, Get, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import { DashboardReportQueryDto, DashboardReportResponseDto } from "./dto/reports.dto";
import { ReportsService } from "./reports.service";

@ApiBearerAuth()
@ApiTags("Admin reports")
@Controller("admin/reports")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  @RequirePermission(PermissionCode.ReportsRead)
  @ApiOperation({
    summary: "Get dashboard cards and charts with date and warehouse filters."
  })
  @ApiOkResponse({
    description: "Dashboard report returned.",
    type: DashboardReportResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks reports.read permission or warehouse assignment." })
  getDashboard(
    @Query() query: DashboardReportQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.reportsService.getDashboard(query, getAuth(request));
  }
}

function getAuth(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Admin access token is missing or invalid.");
  }

  return request.auth;
}
