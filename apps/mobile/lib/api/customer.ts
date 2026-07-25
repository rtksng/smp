import { z } from "zod";
import {
  addressInputSchema,
  addressSchema,
  customerProfileSchema,
  type AddressInput
} from "./schemas";
import { requestCustomerApi } from "./customer-client";

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
    body: input,
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
