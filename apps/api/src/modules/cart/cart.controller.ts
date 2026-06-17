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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { CustomerJwtGuard } from "../auth/guards/customer-jwt.guard";
import { CartService } from "./cart.service";
import {
  AddCartItemDto,
  CartResponseDto,
  GetCartQueryDto,
  UpdateCartItemDto
} from "./dto/cart.dto";

@ApiBearerAuth()
@ApiTags("Cart")
@Controller("cart")
@UseGuards(CustomerJwtGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated customer's cart." })
  @ApiOkResponse({
    description: "Customer cart returned.",
    type: CartResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  getCart(
    @Query() query: GetCartQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.cartService.getCart(getCustomerId(request), query);
  }

  @Post("items")
  @ApiOperation({ summary: "Add a product or product variant to the cart." })
  @ApiCreatedResponse({
    description: "Cart item added and cart totals recalculated.",
    type: CartResponseDto
  })
  @ApiBadRequestResponse({
    description: "Product, variant, or requested quantity is not available."
  })
  @ApiNotFoundResponse({ description: "Product or variant was not found." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  addItem(
    @Body() body: AddCartItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.cartService.addItem(getCustomerId(request), body);
  }

  @Post("buy-now")
  @ApiOperation({
    summary: "Replace the cart with one product for immediate checkout."
  })
  @ApiCreatedResponse({
    description: "Cart prepared for immediate checkout.",
    type: CartResponseDto
  })
  @ApiBadRequestResponse({
    description: "Product, variant, or requested quantity is not available."
  })
  @ApiNotFoundResponse({ description: "Product or variant was not found." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  buyNow(
    @Body() body: AddCartItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.cartService.replaceWithItem(getCustomerId(request), body);
  }

  @Patch("items/:id")
  @ApiOperation({ summary: "Update one cart item quantity." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({
    description: "Cart item updated and cart totals recalculated.",
    type: CartResponseDto
  })
  @ApiBadRequestResponse({ description: "Requested quantity is not available." })
  @ApiNotFoundResponse({ description: "Cart item was not found for this customer." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  updateItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateCartItemDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.cartService.updateItem(getCustomerId(request), id, body);
  }

  @Delete("items/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove one item from the cart." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({
    description: "Cart item removed and cart totals recalculated.",
    type: CartResponseDto
  })
  @ApiNotFoundResponse({ description: "Cart item was not found for this customer." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  removeItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.cartService.removeItem(getCustomerId(request), id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Clear all items from the authenticated customer's cart." })
  @ApiOkResponse({
    description: "Cart cleared and empty totals returned.",
    type: CartResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  clearCart(@Req() request: AuthenticatedRequest) {
    return this.cartService.clearCart(getCustomerId(request));
  }
}

function getCustomerId(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Customer access token is missing or invalid.");
  }

  return request.auth.sub;
}
