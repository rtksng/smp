import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { isUniqueConstraintError } from "../../common/prisma/prisma-errors";
import { PrismaService } from "../../database/prisma.service";
import { AddressType, Prisma } from "../../generated/prisma/client";
import type {
  CreateCustomerAddressDto,
  CustomerAddressType,
  UpdateCustomerAddressDto,
  UpdateCustomerProfileDto
} from "./dto/customer-profile.dto";

type DecimalValue = number | string | { toNumber?: () => number; toString: () => string };
type CustomerRecord = {
  businessName: string | null;
  email: string | null;
  firstName: string;
  gstNumber: string | null;
  id: string;
  lastName: string | null;
  mobileNumber: string;
};
type AddressRecord = {
  city: string;
  createdAt: Date;
  fullName: string;
  id: string;
  isDefault: boolean;
  landmark: string | null;
  latitude: DecimalValue | null;
  line1: string;
  line2: string | null;
  longitude: DecimalValue | null;
  mobileNumber: string;
  pincode: string;
  state: string;
  type: AddressType | CustomerAddressType;
  updatedAt: Date;
};
type CustomerAddressClient = Pick<
  Prisma.TransactionClient,
  "address"
> | PrismaService;

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

@Injectable()
export class CustomerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(customerId: string) {
    const customer = await this.findActiveCustomer(customerId);

    return this.serializeProfile(customer);
  }

  async updateProfile(customerId: string, input: UpdateCustomerProfileDto) {
    const existingCustomer = await this.findActiveCustomer(customerId);
    const data = this.buildProfileUpdateData(input);

    if (Object.keys(data).length === 0) {
      return this.serializeProfile(existingCustomer);
    }

    try {
      const customer = await this.prisma.user.update({
        data,
        where: {
          id: customerId
        }
      });

      return this.serializeProfile(customer);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Customer email already exists.");
      }

      throw error;
    }
  }

  async listAddresses(customerId: string) {
    await this.findActiveCustomer(customerId);
    const addresses = await this.prisma.address.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      where: {
        deletedAt: null,
        userId: customerId
      }
    });

    return addresses.map((address) => this.serializeAddress(address));
  }

  async createAddress(customerId: string, input: CreateCustomerAddressDto) {
    await this.findActiveCustomer(customerId);
    const address = await this.prisma.$transaction(async (tx) => {
      const defaultAddress = await tx.address.findFirst({
        where: {
          deletedAt: null,
          isDefault: true,
          userId: customerId
        }
      });
      const anyAddress =
        defaultAddress ??
        (await tx.address.findFirst({
          where: {
            deletedAt: null,
            userId: customerId
          }
        }));

      return tx.address.create({
        data: {
          city: input.city,
          fullName: input.fullName,
          isDefault: !anyAddress,
          landmark: input.landmark ?? null,
          latitude: input.latitude ?? null,
          line1: input.addressLine1,
          line2: input.addressLine2 ?? null,
          longitude: input.longitude ?? null,
          mobileNumber: input.phone,
          pincode: input.pincode,
          state: input.state,
          type: input.type as AddressType,
          userId: customerId
        }
      });
    });

    return this.serializeAddress(address);
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    input: UpdateCustomerAddressDto
  ) {
    await this.findActiveCustomer(customerId);
    const existingAddress = await this.findExistingAddress(
      this.prisma,
      customerId,
      addressId
    );
    const data = this.buildAddressUpdateData(input);

    if (Object.keys(data).length === 0) {
      return this.serializeAddress(existingAddress);
    }

    const address = await this.prisma.address.update({
      data,
      where: {
        id: addressId
      }
    });

    return this.serializeAddress(address);
  }

  async deleteAddress(customerId: string, addressId: string) {
    await this.findActiveCustomer(customerId);
    await this.prisma.$transaction(async (tx) => {
      const address = await this.findExistingAddress(tx, customerId, addressId);

      await tx.address.update({
        data: {
          deletedAt: new Date(),
          isDefault: false
        },
        where: {
          id: addressId
        }
      });

      if (!address.isDefault) {
        return;
      }

      const remainingAddresses = await tx.address.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        where: {
          deletedAt: null,
          userId: customerId
        }
      });
      const nextDefaultAddress = remainingAddresses.find(
        (remainingAddress) => remainingAddress.id !== addressId
      );

      if (!nextDefaultAddress) {
        return;
      }

      await tx.address.update({
        data: {
          isDefault: true
        },
        where: {
          id: nextDefaultAddress.id
        }
      });
    });
  }

  async setDefaultAddress(customerId: string, addressId: string) {
    await this.findActiveCustomer(customerId);
    const address = await this.prisma.$transaction(async (tx) => {
      await this.findExistingAddress(tx, customerId, addressId);
      await tx.address.updateMany({
        data: {
          isDefault: false
        },
        where: {
          deletedAt: null,
          userId: customerId
        }
      });

      return tx.address.update({
        data: {
          isDefault: true
        },
        where: {
          id: addressId
        }
      });
    });

    return this.serializeAddress(address);
  }

  private async findActiveCustomer(customerId: string) {
    const customer = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        id: customerId,
        isActive: true
      }
    });

    if (!customer) {
      throw new UnauthorizedException("Customer account is inactive.");
    }

    return customer;
  }

  private async findExistingAddress(
    client: CustomerAddressClient,
    customerId: string,
    addressId: string
  ) {
    const address = await client.address.findFirst({
      where: {
        deletedAt: null,
        id: addressId,
        userId: customerId
      }
    });

    if (!address) {
      throw new NotFoundException("Address was not found.");
    }

    return address;
  }

  private buildProfileUpdateData(input: UpdateCustomerProfileDto) {
    const data: Prisma.UserUncheckedUpdateInput = {};

    if (input.name !== undefined) {
      Object.assign(data, splitCustomerName(input.name));
    }
    if (hasOwn(input, "email")) {
      data.email =
        typeof input.email === "string" ? input.email.toLowerCase() : null;
    }
    if (hasOwn(input, "gstNumber")) {
      data.gstNumber = input.gstNumber ?? null;
    }
    if (hasOwn(input, "businessName")) {
      data.businessName = input.businessName ?? null;
    }

    return data;
  }

  private buildAddressUpdateData(input: UpdateCustomerAddressDto) {
    const data: Prisma.AddressUncheckedUpdateInput = {};

    if (input.addressLine1 !== undefined) {
      data.line1 = input.addressLine1;
    }
    if (hasOwn(input, "addressLine2")) {
      data.line2 = input.addressLine2 ?? null;
    }
    if (input.city !== undefined) {
      data.city = input.city;
    }
    if (input.fullName !== undefined) {
      data.fullName = input.fullName;
    }
    if (hasOwn(input, "landmark")) {
      data.landmark = input.landmark ?? null;
    }
    if (hasOwn(input, "latitude")) {
      data.latitude = input.latitude ?? null;
    }
    if (hasOwn(input, "longitude")) {
      data.longitude = input.longitude ?? null;
    }
    if (input.phone !== undefined) {
      data.mobileNumber = input.phone;
    }
    if (input.pincode !== undefined) {
      data.pincode = input.pincode;
    }
    if (input.state !== undefined) {
      data.state = input.state;
    }
    if (input.type !== undefined) {
      data.type = input.type as AddressType;
    }

    return data;
  }

  private serializeProfile(customer: CustomerRecord) {
    return {
      businessName: customer.businessName,
      email: customer.email,
      gstNumber: customer.gstNumber,
      id: customer.id,
      mobileNumber: customer.mobileNumber,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(" ")
    };
  }

  private serializeAddress(address: AddressRecord) {
    return {
      addressLine1: address.line1,
      addressLine2: address.line2,
      city: address.city,
      createdAt: address.createdAt,
      fullName: address.fullName,
      id: address.id,
      isDefault: address.isDefault,
      landmark: address.landmark,
      latitude: decimalToNumberOrNull(address.latitude),
      longitude: decimalToNumberOrNull(address.longitude),
      phone: address.mobileNumber,
      pincode: address.pincode,
      state: address.state,
      type: address.type,
      updatedAt: address.updatedAt
    };
  }
}

function splitCustomerName(name: string) {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  const [firstName, ...lastNameParts] = normalizedName.split(" ");

  return {
    firstName,
    lastName: lastNameParts.length > 0 ? lastNameParts.join(" ") : null
  };
}

function decimalToNumberOrNull(value: DecimalValue | null) {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value.toString());
}
