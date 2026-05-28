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
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/guards/authenticated-request";
import { CustomerJwtGuard } from "../auth/guards/customer-jwt.guard";
import { CustomerProfileService } from "./customer-profile.service";
import {
  CreateCustomerAddressDto,
  CustomerAddressResponseDto,
  CustomerProfileResponseDto,
  UpdateCustomerAddressDto,
  UpdateCustomerProfileDto
} from "./dto/customer-profile.dto";

@ApiBearerAuth()
@ApiTags("Customer profile")
@Controller("me")
@UseGuards(CustomerJwtGuard)
export class CustomerProfileController {
  constructor(private readonly customerProfileService: CustomerProfileService) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated customer's profile." })
  @ApiOkResponse({
    description: "Customer profile returned.",
    type: CustomerProfileResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.customerProfileService.getProfile(getCustomerId(request));
  }

  @Patch()
  @ApiOperation({ summary: "Update the authenticated customer's profile." })
  @ApiOkResponse({
    description: "Customer profile updated.",
    type: CustomerProfileResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  updateProfile(
    @Body() body: UpdateCustomerProfileDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.customerProfileService.updateProfile(
      getCustomerId(request),
      body
    );
  }

  @Get("addresses")
  @ApiOperation({ summary: "List the authenticated customer's addresses." })
  @ApiOkResponse({
    description: "Customer addresses returned.",
    type: [CustomerAddressResponseDto]
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  listAddresses(@Req() request: AuthenticatedRequest) {
    return this.customerProfileService.listAddresses(getCustomerId(request));
  }

  @Post("addresses")
  @ApiOperation({ summary: "Add a customer address." })
  @ApiCreatedResponse({
    description: "Customer address created.",
    type: CustomerAddressResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  createAddress(
    @Body() body: CreateCustomerAddressDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.customerProfileService.createAddress(
      getCustomerId(request),
      body
    );
  }

  @Patch("addresses/:id")
  @ApiOperation({ summary: "Update one customer address." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({
    description: "Customer address updated.",
    type: CustomerAddressResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  @ApiNotFoundResponse({ description: "Address does not exist for this customer." })
  updateAddress(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateCustomerAddressDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.customerProfileService.updateAddress(
      getCustomerId(request),
      id,
      body
    );
  }

  @Delete("addresses/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft delete one customer address." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiNoContentResponse({ description: "Customer address deleted." })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  @ApiNotFoundResponse({ description: "Address does not exist for this customer." })
  async deleteAddress(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.customerProfileService.deleteAddress(getCustomerId(request), id);
  }

  @Patch("addresses/:id/default")
  @ApiOperation({ summary: "Set one customer address as default." })
  @ApiParam({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6", name: "id" })
  @ApiOkResponse({
    description: "Customer default address updated.",
    type: CustomerAddressResponseDto
  })
  @ApiUnauthorizedResponse({ description: "Customer access token is missing or invalid." })
  @ApiNotFoundResponse({ description: "Address does not exist for this customer." })
  setDefaultAddress(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.customerProfileService.setDefaultAddress(
      getCustomerId(request),
      id
    );
  }
}

function getCustomerId(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new UnauthorizedException("Customer access token is missing or invalid.");
  }

  return request.auth.sub;
}
