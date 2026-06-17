import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { CustomerJwtGuard } from "../auth/guards/customer-jwt.guard";
import { ProductListResponseDto } from "../products/dto/product-response.dto";
import { WishlistItemDto } from "./dto/wishlist.dto";
import { WishlistService } from "./wishlist.service";

@ApiBearerAuth()
@ApiTags("Wishlist")
@Controller("wishlist")
@UseGuards(CustomerJwtGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "List saved products for the authenticated customer." })
  @ApiOkResponse({
    description: "Wishlist products returned.",
    type: ProductListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  listWishlist(@Req() request: AuthenticatedRequest) {
    return this.wishlistService.listWishlist(getCustomerId(request));
  }

  @Post()
  @ApiOperation({ summary: "Save a product for later." })
  @ApiCreatedResponse({
    description: "Product saved and wishlist returned.",
    type: ProductListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  addWishlistItem(
    @Body() body: WishlistItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.wishlistService.addWishlistItem(
      getCustomerId(request),
      body.productId
    );
  }

  @Delete(":productId")
  @ApiOperation({ summary: "Remove a saved product." })
  @ApiOkResponse({
    description: "Product removed and wishlist returned.",
    type: ProductListResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  removeWishlistItem(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.wishlistService.removeWishlistItem(
      getCustomerId(request),
      productId
    );
  }
}

function getCustomerId(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Customer access token is missing or invalid.");
  }

  return request.auth.sub;
}
