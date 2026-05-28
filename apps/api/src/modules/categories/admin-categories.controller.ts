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
  ApiBadRequestResponse,
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
import { CategoriesService } from "./categories.service";
import { CategoryResponseDto } from "./dto/category-response.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@ApiBearerAuth()
@ApiTags("Admin categories")
@Controller("admin/categories")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermission(PermissionCode.ProductsRead)
  @ApiOperation({ summary: "List all non-deleted categories for admin management." })
  @ApiOkResponse({
    description: "Admin category list returned.",
    type: [CategoryResponseDto]
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.read permission." })
  listCategories() {
    return this.categoriesService.listAdminCategories();
  }

  @Post()
  @RequirePermission(PermissionCode.ProductsCreate)
  @ApiOperation({ summary: "Create a category." })
  @ApiCreatedResponse({
    description: "Category created.",
    type: CategoryResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.create permission." })
  @ApiConflictResponse({ description: "Category slug already exists." })
  @ApiNotFoundResponse({ description: "Parent category does not exist." })
  createCategory(
    @Body() body: CreateCategoryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.categoriesService.createCategory(body, getAdminActionContext(request));
  }

  @Patch(":id")
  @RequirePermission(PermissionCode.ProductsUpdate)
  @ApiOperation({ summary: "Update a category." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Category updated.",
    type: CategoryResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.update permission." })
  @ApiBadRequestResponse({ description: "Parent category assignment is invalid." })
  @ApiConflictResponse({ description: "Category slug already exists." })
  @ApiNotFoundResponse({ description: "Category or parent category does not exist." })
  updateCategory(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateCategoryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.categoriesService.updateCategory(
      id,
      body,
      getAdminActionContext(request)
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionCode.ProductsDelete)
  @ApiOperation({ summary: "Soft delete a category and its descendants." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiNoContentResponse({ description: "Category soft deleted." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.delete permission." })
  @ApiNotFoundResponse({ description: "Category does not exist." })
  async deleteCategory(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.categoriesService.deleteCategory(id, getAdminActionContext(request));
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
