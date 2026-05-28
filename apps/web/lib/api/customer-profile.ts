import { z } from "zod";
import { requestCustomerApi } from "./customer-client";

export const customerProfileDetailsSchema = z.object({
  businessName: z.string().nullable(),
  email: z.string().nullable(),
  gstNumber: z.string().nullable(),
  id: z.string(),
  mobileNumber: z.string(),
  name: z.string()
});

export const customerAddressTypeSchema = z.enum([
  "CLINIC",
  "HOME",
  "HOSPITAL",
  "OTHER",
  "WORK"
]);

export const customerAddressSchema = z.object({
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  createdAt: z.string(),
  fullName: z.string(),
  id: z.string(),
  isDefault: z.boolean(),
  landmark: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  phone: z.string(),
  pincode: z.string(),
  state: z.string(),
  type: customerAddressTypeSchema,
  updatedAt: z.string()
});

export const createCustomerAddressInputSchema = z.object({
  addressLine1: z.string().trim().min(1, "Address line 1 is required.").max(500),
  addressLine2: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().min(1, "City is required.").max(120),
  fullName: z.string().trim().min(1, "Full name is required.").max(160),
  landmark: z.string().trim().max(160).nullable().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use an E.164 phone number, for example +919876543210."),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, "Enter a 6 digit pincode."),
  state: z.string().trim().min(1, "State is required.").max(120),
  type: customerAddressTypeSchema
});

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

export const updateCustomerAddressInputSchema =
  createCustomerAddressInputSchema.partial();

export type CustomerProfileDetails = z.infer<
  typeof customerProfileDetailsSchema
>;
export type CustomerAddress = z.infer<typeof customerAddressSchema>;
export type CustomerAddressType = z.infer<typeof customerAddressTypeSchema>;
export type CreateCustomerAddressInput = z.infer<
  typeof createCustomerAddressInputSchema
>;
export type UpdateCustomerProfileInput = z.infer<
  typeof updateCustomerProfileInputSchema
>;
export type UpdateCustomerAddressInput = z.infer<
  typeof updateCustomerAddressInputSchema
>;

export function getCustomerProfile() {
  return requestCustomerApi("/me", customerProfileDetailsSchema);
}

export function updateCustomerProfile(input: UpdateCustomerProfileInput) {
  const parsedInput = updateCustomerProfileInputSchema.parse(input);

  return requestCustomerApi("/me", customerProfileDetailsSchema, {
    body: JSON.stringify(parsedInput),
    method: "PATCH"
  });
}

export function listCustomerAddresses() {
  return requestCustomerApi("/me/addresses", z.array(customerAddressSchema));
}

export function createCustomerAddress(input: CreateCustomerAddressInput) {
  const parsedInput = createCustomerAddressInputSchema.parse(input);

  return requestCustomerApi("/me/addresses", customerAddressSchema, {
    body: JSON.stringify(parsedInput),
    method: "POST"
  });
}

export function updateCustomerAddress(
  addressId: string,
  input: UpdateCustomerAddressInput
) {
  const parsedInput = updateCustomerAddressInputSchema.parse(input);

  return requestCustomerApi(
    `/me/addresses/${encodeURIComponent(addressId)}`,
    customerAddressSchema,
    {
      body: JSON.stringify(parsedInput),
      method: "PATCH"
    }
  );
}

export function setDefaultCustomerAddress(addressId: string) {
  return requestCustomerApi(
    `/me/addresses/${encodeURIComponent(addressId)}/default`,
    customerAddressSchema,
    {
      method: "PATCH"
    }
  );
}

export function deleteCustomerAddress(addressId: string) {
  return requestCustomerApi(
    `/me/addresses/${encodeURIComponent(addressId)}`,
    z.undefined(),
    {
      method: "DELETE"
    }
  );
}
