import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import { BrandResponseDto } from "./dto/brand-response.dto";
import { BrandsService } from "./brands.service";

@ApiTags("Brands")
@Controller("brands")
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({ summary: "List active public brands." })
  @ApiOkResponse({
    description: "Active brands returned.",
    type: [BrandResponseDto]
  })
  listBrands() {
    return this.brandsService.listPublicBrands();
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get an active public brand by slug." })
  @ApiParam({
    example: "acme-surgical",
    name: "slug"
  })
  @ApiOkResponse({
    description: "Active brand returned.",
    type: BrandResponseDto
  })
  @ApiNotFoundResponse({ description: "Brand slug is inactive or does not exist." })
  getBrandBySlug(@Param("slug") slug: string) {
    return this.brandsService.getPublicBrandBySlug(slug);
  }
}
