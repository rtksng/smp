import { z } from "zod";
import {
  addressInputSchema,
  addressSchema,
  customerProfileSchema,
  type AddressInput
} from "./schemas";
import { requestCustomerApi } from "./customer-client";

export const updateCustomerProfileInputSchema = z.object({
  businessName: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().email("Enter a valid email.").max(254).nullable().optional(),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
      "Enter a valid GSTIN."
    )
    .nullable()
    .optional(),
  name: z.string().trim().min(1, "Name is required.").max(160).optional()
});

export function getCustomerProfile() {
  return requestCustomerApi("/me", customerProfileSchema);
}

export function updateCustomerProfile(input: {
  businessName?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  name?: string;
}) {
  return requestCustomerApi("/me", customerProfileSchema, {
    body: updateCustomerProfileInputSchema.parse(input),
    method: "PATCH"
  });
}

export function listAddresses() {
  return requestCustomerApi("/me/addresses", z.array(addressSchema));
}

export function createAddress(input: AddressInput) {
  return requestCustomerApi("/me/addresses", addressSchema, {
    body: addressInputSchema.parse(input),
    method: "POST"
  });
}

export function updateAddress(addressId: string, input: Partial<AddressInput>) {
  return requestCustomerApi(
    `/me/addresses/${encodeURIComponent(addressId)}`,
    addressSchema,
    {
      body: addressInputSchema.partial().parse(input),
      method: "PATCH"
    }
  );
}

export function setDefaultAddress(addressId: string) {
  return requestCustomerApi(
    `/me/addresses/${encodeURIComponent(addressId)}/default`,
    addressSchema,
    { method: "PATCH" }
  );
}

export function deleteAddress(addressId: string) {
  return requestCustomerApi(
    `/me/addresses/${encodeURIComponent(addressId)}`,
    z.undefined(),
    { method: "DELETE" }
  );
}
