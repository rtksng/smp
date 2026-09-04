import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { Response } from "express";
import { API_RESPONSE_SKIP_HEADER } from "../../common/interceptors/api-response.interceptor";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import {
  DashboardReportExportQueryDto,
  DashboardReportQueryDto,
  DashboardReportResponseDto
} from "./dto/reports.dto";
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

  @Get("dashboard/export")
  @RequirePermission(PermissionCode.ReportsRead)
  @ApiOperation({
    summary: "Export dashboard report data as CSV or PDF."
  })
  @ApiProduces("text/csv", "application/pdf")
  @ApiOkResponse({
    description: "Dashboard report export returned."
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks reports.read permission or warehouse assignment." })
  async exportDashboard(
    @Query() query: DashboardReportExportQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const exported = await this.reportsService.exportDashboard(
      query,
      getAuth(request),
      query.format ?? "csv"
    );

    response.setHeader(API_RESPONSE_SKIP_HEADER, "true");
    response.setHeader("content-type", exported.contentType);
    response.setHeader(
      "content-disposition",
      `attachment; filename="${exported.filename}"`
    );
    response.setHeader("content-length", String(exported.body.byteLength));

    return new StreamableFile(exported.body);
  }
}

function getAuth(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Admin access token is missing or invalid.");
  }

  return request.auth;
}
