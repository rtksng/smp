import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import { ProductListQueryDto } from "./dto/product-query.dto";
import {
  ProductListResponseDto,
  ProductResponseDto
} from "./dto/product-response.dto";
import { ProductsService } from "./products.service";

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "List public products with search, filters, sorting, and pagination." })
  @ApiOkResponse({
    description: "Public product list returned.",
    type: ProductListResponseDto
  })
  listProducts(@Query() query: ProductListQueryDto) {
    return this.productsService.listPublicProducts(query);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get public product detail by slug." })
  @ApiParam({
    example: "curved-artery-forceps",
    name: "slug"
  })
  @ApiOkResponse({
    description: "Public product detail returned.",
    type: ProductResponseDto
  })
  @ApiNotFoundResponse({ description: "Product slug is inactive or does not exist." })
  getProductBySlug(@Param("slug") slug: string) {
    return this.productsService.getPublicProductBySlug(slug);
  }
}
