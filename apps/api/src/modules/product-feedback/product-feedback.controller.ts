import {
  Body,
  Controller,
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
import {
  AdminProductFeedbackListQueryDto,
  AdminProductFeedbackListResponseDto,
  AnswerProductQuestionDto,
  CreateProductQuestionDto,
  CreateProductReviewDto,
  ProductFeedbackResponseDto,
  ProductQuestionResponseDto
} from "./dto/product-feedback.dto";
import { ProductFeedbackService } from "./product-feedback.service";

@ApiTags("Product feedback")
@Controller("products/:slug/feedback")
export class ProductFeedbackController {
  constructor(private readonly productFeedbackService: ProductFeedbackService) {}

  @Get()
  @ApiOperation({ summary: "List public product reviews and questions." })
  @ApiOkResponse({
    description: "Product feedback returned.",
    type: ProductFeedbackResponseDto
  })
  listFeedback(@Param("slug") slug: string) {
    return this.productFeedbackService.listFeedback(slug);
  }

  @Post("reviews")
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a product review." })
  @ApiCreatedResponse({
    description: "Review saved and product feedback returned.",
    type: ProductFeedbackResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  createReview(
    @Param("slug") slug: string,
    @Body() body: CreateProductReviewDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productFeedbackService.createReview(
      getCustomerId(request),
      slug,
      body
    );
  }

  @Post("questions")
  @UseGuards(CustomerJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a product question." })
  @ApiCreatedResponse({
    description: "Question saved and product feedback returned.",
    type: ProductFeedbackResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  createQuestion(
    @Param("slug") slug: string,
    @Body() body: CreateProductQuestionDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.productFeedbackService.createQuestion(
      getCustomerId(request),
      slug,
      body
    );
  }
}

@ApiBearerAuth()
@ApiTags("Admin product feedback")
@Controller("admin/product-feedback")
@UseGuards(AdminJwtGuard, PermissionGuard)
export class AdminProductFeedbackController {
  constructor(private readonly productFeedbackService: ProductFeedbackService) {}

  @Get()
  @RequirePermission(PermissionCode.ProductsRead)
  @ApiOperation({ summary: "List product feedback for admin review." })
  @ApiOkResponse({
    description: "Product feedback returned.",
    type: AdminProductFeedbackListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  listAdminFeedback(@Query() query: AdminProductFeedbackListQueryDto) {
    return this.productFeedbackService.listAdminFeedback(query);
  }

  @Patch("questions/:id/answer")
  @RequirePermission(PermissionCode.ProductsUpdate)
  @ApiOperation({ summary: "Answer a product question." })
  @ApiOkResponse({
    description: "Product question answered.",
    type: ProductQuestionResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Admin access token is missing or invalid." })
  answerQuestion(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AnswerProductQuestionDto
  ) {
    return this.productFeedbackService.answerQuestion(id, body);
  }
}

function getCustomerId(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Customer access token is missing or invalid.");
  }

  return request.auth.sub;
}
