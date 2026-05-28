import { Controller, Get, Param } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import { CategoriesService } from "./categories.service";
import { CategoryResponseDto } from "./dto/category-response.dto";

@ApiTags("Categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "List active public categories." })
  @ApiOkResponse({
    description: "Active category tree returned.",
    type: [CategoryResponseDto]
  })
  listCategories() {
    return this.categoriesService.listPublicCategories();
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get an active public category by slug." })
  @ApiParam({
    example: "surgical-instruments",
    name: "slug"
  })
  @ApiOkResponse({
    description: "Active category returned.",
    type: CategoryResponseDto
  })
  @ApiNotFoundResponse({ description: "Category slug is inactive or does not exist." })
  getCategoryBySlug(@Param("slug") slug: string) {
    return this.categoriesService.getPublicCategoryBySlug(slug);
  }
}
