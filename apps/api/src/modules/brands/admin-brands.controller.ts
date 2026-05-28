import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { getAuthRequestContext } from "../auth/common/request-context";
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { BrandsService } from "./brands.service";
import { BrandResponseDto } from "./dto/brand-response.dto";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@ApiBearerAuth()
@ApiTags("Admin brands")
@Controller("admin/brands")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminBrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @RequirePermission(PermissionCode.ProductsRead)
  @ApiOperation({ summary: "List all non-deleted brands for admin management." })
  @ApiOkResponse({
    description: "Admin brand list returned.",
    type: [BrandResponseDto]
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.read permission." })
  listBrands() {
    return this.brandsService.listAdminBrands();
  }

  @Post()
  @RequirePermission(PermissionCode.ProductsCreate)
  @ApiOperation({ summary: "Create a brand." })
  @ApiCreatedResponse({
    description: "Brand created.",
    type: BrandResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.create permission." })
  @ApiConflictResponse({ description: "Brand slug already exists." })
  createBrand(@Body() body: CreateBrandDto, @Req() request: AuthenticatedRequest) {
    return this.brandsService.createBrand(body, getAdminActionContext(request));
  }

  @Patch(":id")
  @RequirePermission(PermissionCode.ProductsUpdate)
  @ApiOperation({ summary: "Update a brand." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Brand updated.",
    type: BrandResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.update permission." })
  @ApiConflictResponse({ description: "Brand slug already exists." })
  @ApiNotFoundResponse({ description: "Brand does not exist." })
  updateBrand(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateBrandDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.brandsService.updateBrand(id, body, getAdminActionContext(request));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionCode.ProductsDelete)
  @ApiOperation({ summary: "Soft delete a brand." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiNoContentResponse({ description: "Brand soft deleted." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.delete permission." })
  @ApiNotFoundResponse({ description: "Brand does not exist." })
  async deleteBrand(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.brandsService.deleteBrand(id, getAdminActionContext(request));
  }
}

function getAuth(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Admin access token is missing or invalid.");
  }

  return request.auth;
}

function getAdminActionContext(request: AuthenticatedRequest): AdminActionContext {
  return {
    auth: getAuth(request),
    ...getAuthRequestContext(request)
  };
}
