import {
  Body,
  Controller,
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
import {
  CreateQuoteRequestDto,
  QuoteRequestListQueryDto,
  QuoteRequestListResponseDto,
  QuoteRequestResponseDto,
  UpdateQuoteRequestStatusDto
} from "./dto/quote-request.dto";
import { QuoteRequestsService } from "./quote-requests.service";

@ApiTags("Quote requests")
@Controller("quote-requests")
export class QuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  @Post()
  @ApiOperation({ summary: "Create a bulk quote request from the customer website." })
  @ApiCreatedResponse({
    description: "Quote request saved.",
    type: QuoteRequestResponseDto
  })
  createQuoteRequest(@Body() body: CreateQuoteRequestDto) {
    return this.quoteRequestsService.createQuoteRequest(body);
  }
}

@ApiBearerAuth()
@ApiTags("Admin quote requests")
@Controller("admin/quote-requests")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminQuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  @Get()
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "List bulk quote requests for admin follow-up." })
  @ApiOkResponse({
    description: "Quote requests returned.",
    type: QuoteRequestListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  listQuoteRequests(@Query() query: QuoteRequestListQueryDto) {
    return this.quoteRequestsService.listAdminQuoteRequests(query);
  }

  @Patch(":id/status")
  @RequirePermission(PermissionCode.SettingsManage)
  @ApiOperation({ summary: "Update a quote request follow-up status." })
  @ApiOkResponse({
    description: "Quote request status updated.",
    type: QuoteRequestResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  updateQuoteRequestStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateQuoteRequestStatusDto
  ) {
    return this.quoteRequestsService.updateAdminQuoteRequestStatus(id, body);
  }
}
