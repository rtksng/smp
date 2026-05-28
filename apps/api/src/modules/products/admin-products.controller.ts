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
  Query,
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
import { AdminJwtGuard } from "../auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { PermissionCode } from "../permissions/permissions.constants";
import { CreateProductDto } from "./dto/create-product.dto";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { getAuthRequestContext } from "../auth/common/request-context";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { AdminProductListQueryDto } from "./dto/product-query.dto";
import { ProductListResponseDto, ProductResponseDto } from "./dto/product-response.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiBearerAuth()
@ApiTags("Admin products")
@Controller("admin/products")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermission(PermissionCode.ProductsCreate)
  @ApiOperation({ summary: "Create a product." })
  @ApiCreatedResponse({
    description: "Product created.",
    type: ProductResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.create permission." })
  @ApiBadRequestResponse({ description: "Product prices or payload are invalid." })
  @ApiConflictResponse({ description: "Product slug or SKU already exists." })
  @ApiNotFoundResponse({ description: "Brand or category does not exist." })
  createProduct(@Body() body: CreateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.createProduct(body, getAdminActionContext(request));
  }

  @Get()
  @RequirePermission(PermissionCode.ProductsRead)
  @ApiOperation({
    summary: "List admin products with search, filters, sorting, and pagination."
  })
  @ApiOkResponse({
    description: "Admin product list returned.",
    type: ProductListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.read permission." })
  listProducts(@Query() query: AdminProductListQueryDto) {
    return this.productsService.listAdminProducts(query);
  }

  @Get(":id")
  @RequirePermission(PermissionCode.ProductsRead)
  @ApiOperation({ summary: "Get an admin product by id." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Admin product returned.",
    type: ProductResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.read permission." })
  @ApiNotFoundResponse({ description: "Product does not exist." })
  getProduct(@Param("id", ParseUUIDPipe) id: string) {
    return this.productsService.getAdminProductById(id);
  }

  @Patch(":id")
  @RequirePermission(PermissionCode.ProductsUpdate)
  @ApiOperation({ summary: "Update a product." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiOkResponse({
    description: "Product updated.",
    type: ProductResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.update permission." })
  @ApiBadRequestResponse({ description: "Product prices or payload are invalid." })
  @ApiConflictResponse({ description: "Product slug or SKU already exists." })
  @ApiNotFoundResponse({ description: "Product, brand, or category does not exist." })
  updateProduct(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateProductDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productsService.updateProduct(id, body, getAdminActionContext(request));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PermissionCode.ProductsDelete)
  @ApiOperation({ summary: "Soft delete a product." })
  @ApiParam({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    name: "id"
  })
  @ApiNoContentResponse({ description: "Product soft deleted." })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  @ApiForbiddenResponse({ description: "Admin lacks products.delete permission." })
  @ApiNotFoundResponse({ description: "Product does not exist." })
  async deleteProduct(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.productsService.deleteProduct(id, getAdminActionContext(request));
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
