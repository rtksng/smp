"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Edit3, MapPin, Plus, Trash2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import {
  createCreateAddressMutation,
  createDeleteAddressMutation,
  createSetDefaultAddressMutation,
  createUpdateAddressMutation
} from "../../lib/api/mutation-helpers";
import { customerQueryKeys } from "../../lib/api/query-keys";
import {
  createCustomerAddressInputSchema,
  listCustomerAddresses,
  type CreateCustomerAddressInput,
  type CustomerAddress,
  type CustomerAddressType
} from "../../lib/api/customer-profile";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { Button } from "../ui/button";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import {
  AccountInfoGrid,
  AccountSection,
  AccountSectionHeader,
  AccountStatusBadge,
  CustomerAccountShell,
  PrivateEmptyState
} from "./customer-account-shell";

type AddressFieldErrors = Partial<
  Record<keyof CreateCustomerAddressInput, string>
>;
type AddressFormMode =
  | { type: "closed" }
  | { type: "create" }
  | { address: CustomerAddress; type: "edit" };

const addressTypeOptions: Array<{
  label: string;
  value: CustomerAddressType;
}> = [
  { label: "Home", value: "HOME" },
  { label: "Work", value: "WORK" },
  { label: "Clinic", value: "CLINIC" },
  { label: "Hospital", value: "HOSPITAL" },
  { label: "Other", value: "OTHER" }
];

const emptyAddressForm: CreateCustomerAddressInput = {
  addressLine1: "",
  addressLine2: null,
  city: "",
  fullName: "",
  landmark: null,
  phone: "",
  pincode: "",
  state: "",
  type: "CLINIC"
};

export function AccountAddresses() {
  const queryClient = useQueryClient();
  const customerMobile = useCustomerAuthStore(
    (state) => state.session?.customer.mobileNumber
  );
  const addressesQuery = useQuery({
    queryFn: listCustomerAddresses,
    queryKey: customerQueryKeys.addresses()
  });
  const [formMode, setFormMode] = useState<AddressFormMode>({ type: "closed" });
  const [addressForm, setAddressForm] =
    useState<CreateCustomerAddressInput>(emptyAddressForm);
  const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({});
  const [mutationError, setMutationError] = useState<string | null>(null);
  const createAddressMutation = useMutation(
    createCreateAddressMutation({
      onSuccess: closeForm,
      queryClient
    })
  );
  const updateAddressMutation = useMutation(
    createUpdateAddressMutation({
      onSuccess: closeForm,
      queryClient
    })
  );
  const setDefaultAddressMutation = useMutation(
    createSetDefaultAddressMutation({ queryClient })
  );
  const deleteAddressMutation = useMutation(
    createDeleteAddressMutation({ queryClient })
  );
  const addresses = addressesQuery.data ?? [];
  const defaultAddress = addresses.find((address) => address.isDefault);
  const isSaving =
    createAddressMutation.isPending || updateAddressMutation.isPending;

  function openCreateForm() {
    setAddressForm({
      ...emptyAddressForm,
      phone: customerMobile ?? ""
    });
    setFieldErrors({});
    setMutationError(null);
    setFormMode({ type: "create" });
  }

  function openEditForm(address: CustomerAddress) {
    setAddressForm({
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      fullName: address.fullName,
      landmark: address.landmark,
      phone: address.phone,
      pincode: address.pincode,
      state: address.state,
      type: address.type
    });
    setFieldErrors({});
    setMutationError(null);
    setFormMode({ address, type: "edit" });
  }

  function closeForm() {
    setFormMode({ type: "closed" });
    setAddressForm(emptyAddressForm);
    setFieldErrors({});
    setMutationError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedInput = createCustomerAddressInputSchema.safeParse(
      normalizeAddressForm(addressForm)
    );

    if (!parsedInput.success) {
      setFieldErrors(toFieldErrors(parsedInput.error.flatten().fieldErrors));
      return;
    }

    try {
      setMutationError(null);

      if (formMode.type === "edit") {
        await updateAddressMutation.mutateAsync({
          addressId: formMode.address.id,
          input: parsedInput.data
        });
        return;
      }

      await createAddressMutation.mutateAsync(parsedInput.data);
    } catch (error) {
      setMutationError(
        getFriendlyApiErrorMessage(error, "Unable to save address.")
      );
    }
  }

  async function handleSetDefault(addressId: string) {
    try {
      setMutationError(null);
      await setDefaultAddressMutation.mutateAsync(addressId);
    } catch (error) {
      setMutationError(
        getFriendlyApiErrorMessage(error, "Unable to set default address.")
      );
    }
  }

  async function handleDelete(address: CustomerAddress) {
    if (!window.confirm(`Delete address for ${address.fullName}?`)) {
      return;
    }

    try {
      setMutationError(null);
      await deleteAddressMutation.mutateAsync(address.id);
    } catch (error) {
      setMutationError(
        getFriendlyApiErrorMessage(error, "Unable to delete address.")
      );
    }
  }

  return (
    <CustomerAccountShell
      activePath="/account/addresses"
      description="Manage delivery and billing addresses for faster checkout."
      title="Addresses"
    >
      {addressesQuery.isLoading ? <AddressSkeleton /> : null}

      {addressesQuery.isError ? (
        <ErrorState
          action={<RetryButton onRetry={() => addressesQuery.refetch()} />}
          message={getFriendlyApiErrorMessage(
            addressesQuery.error,
            "Unable to load addresses."
          )}
          title="Unable to load addresses"
        />
      ) : null}

      {mutationError ? (
        <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-bold text-[#7a271a]">
          {mutationError}
        </p>
      ) : null}

      {addressesQuery.isSuccess ? (
        <AccountInfoGrid
          items={[
            { label: "Saved addresses", value: String(addresses.length) },
            {
              label: "Default",
              value: defaultAddress?.fullName ?? "Not selected"
            },
            { label: "City", value: defaultAddress?.city ?? "-" },
            { label: "Phone", value: defaultAddress?.phone ?? "-" }
          ]}
        />
      ) : null}

      {formMode.type !== "closed" ? (
        <AddressForm
          addressErrors={fieldErrors}
          addressForm={addressForm}
          formTitle={formMode.type === "create" ? "Add address" : "Edit address"}
          isSaving={isSaving}
          onCancel={closeForm}
          onChange={(field, value) =>
            setAddressForm((current) => ({
              ...current,
              [field]: value
            }))
          }
          onSubmit={handleSubmit}
        />
      ) : null}

      {addressesQuery.isSuccess && addresses.length === 0 ? (
        <PrivateEmptyState
          action={<Button onClick={openCreateForm}>Add address</Button>}
          description="Save clinic, hospital, home, work, or other delivery addresses before placing orders."
          title="No saved addresses"
        />
      ) : null}

      {addresses.length > 0 ? (
        <AccountSection>
          <AccountSectionHeader
            action={
              <Button className="w-full sm:w-auto" onClick={openCreateForm}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add address
              </Button>
            }
            description="Address changes are available immediately during checkout."
            title="Saved addresses"
          />
          <div className="mt-4 grid gap-3">
            {addresses.map((address) => (
              <AddressCard
                address={address}
                isDeleting={deleteAddressMutation.isPending}
                isSettingDefault={setDefaultAddressMutation.isPending}
                key={address.id}
                onDelete={() => handleDelete(address)}
                onEdit={() => openEditForm(address)}
                onSetDefault={() => handleSetDefault(address.id)}
              />
            ))}
          </div>
        </AccountSection>
      ) : null}
    </CustomerAccountShell>
  );
}

function AddressCard({
  address,
  isDeleting,
  isSettingDefault,
  onDelete,
  onEdit,
  onSetDefault
}: {
  address: CustomerAddress;
  isDeleting: boolean;
  isSettingDefault: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onSetDefault: () => void;
}) {
  return (
    <article className="grid gap-4 rounded-lg border border-[#cfe9d2] bg-[#f4fbf5] p-4 shadow-sm shadow-[#287c30]/5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eaf7eb] text-[#287c30]">
          <MapPin aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-[#173b1d]">{address.fullName}</h3>
            <AccountStatusBadge>{formatAddressType(address.type)}</AccountStatusBadge>
            {address.isDefault ? (
              <AccountStatusBadge tone="success">Default</AccountStatusBadge>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#556b57]">
            {address.addressLine1}
            {address.addressLine2 ? `, ${address.addressLine2}` : ""},{" "}
            {address.city}, {address.state} {address.pincode}
          </p>
          {address.landmark ? (
            <p className="mt-1 text-sm font-semibold text-[#556b57]">
              Landmark: {address.landmark}
            </p>
          ) : null}
          <p className="mt-1 text-sm font-semibold text-[#556b57]">
            {address.phone}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button className="w-full sm:w-auto" onClick={onEdit} variant="outline">
          <Edit3 aria-hidden="true" className="h-4 w-4" />
          Edit
        </Button>
        {!address.isDefault ? (
          <Button
            className="w-full sm:w-auto"
            disabled={isSettingDefault}
            onClick={onSetDefault}
            variant="outline"
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            Set default
          </Button>
        ) : null}
        <Button
          className="w-full sm:w-auto"
          disabled={isDeleting}
          onClick={onDelete}
          variant="ghost"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </article>
  );
}

function AddressForm({
  addressErrors,
  addressForm,
  formTitle,
  isSaving,
  onCancel,
  onChange,
  onSubmit
}: {
  addressErrors: AddressFieldErrors;
  addressForm: CreateCustomerAddressInput;
  formTitle: string;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (
    field: keyof CreateCustomerAddressInput,
    value: CreateCustomerAddressInput[keyof CreateCustomerAddressInput]
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AccountSection>
      <form className="grid gap-5" onSubmit={onSubmit}>
        <AccountSectionHeader
          action={
            <Button onClick={onCancel} type="button" variant="ghost">
              <X aria-hidden="true" className="h-4 w-4" />
              Cancel
            </Button>
          }
          description="Use an address that can receive medical equipment deliveries."
          title={formTitle}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            error={addressErrors.fullName}
            label="Full name"
            name="fullName"
            onChange={(event) => onChange("fullName", event.target.value)}
            value={addressForm.fullName}
          />
          <Input
            error={addressErrors.phone}
            label="Phone"
            name="phone"
            onChange={(event) => onChange("phone", event.target.value)}
            placeholder="+919876543210"
            value={addressForm.phone}
          />
          <Input
            className="md:col-span-2"
            error={addressErrors.addressLine1}
            label="Address line 1"
            name="addressLine1"
            onChange={(event) => onChange("addressLine1", event.target.value)}
            value={addressForm.addressLine1}
          />
          <Input
            error={addressErrors.addressLine2}
            label="Address line 2"
            name="addressLine2"
            onChange={(event) => onChange("addressLine2", event.target.value)}
            value={addressForm.addressLine2 ?? ""}
          />
          <Input
            error={addressErrors.landmark}
            label="Landmark"
            name="landmark"
            onChange={(event) => onChange("landmark", event.target.value)}
            value={addressForm.landmark ?? ""}
          />
          <Input
            error={addressErrors.city}
            label="City"
            name="city"
            onChange={(event) => onChange("city", event.target.value)}
            value={addressForm.city}
          />
          <Input
            error={addressErrors.state}
            label="State"
            name="state"
            onChange={(event) => onChange("state", event.target.value)}
            value={addressForm.state}
          />
          <Input
            error={addressErrors.pincode}
            label="Pincode"
            name="pincode"
            onChange={(event) => onChange("pincode", event.target.value)}
            value={addressForm.pincode}
          />
          <label className="grid gap-2 text-sm font-bold text-[#173b1d]">
            <span>Address type</span>
            <select
              className="min-h-12 rounded-full border border-[#a9ddae] bg-white px-5 text-sm font-semibold text-[#173b1d] outline-none transition focus:border-[#287c30] focus:ring-2 focus:ring-[#287c30]/20"
              onChange={(event) =>
                onChange("type", event.target.value as CustomerAddressType)
              }
              value={addressForm.type}
            >
              {addressTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <Button className="w-full sm:w-auto" disabled={isSaving} type="submit">
            <Plus aria-hidden="true" className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save address"}
          </Button>
        </div>
      </form>
    </AccountSection>
  );
}

function AddressSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-20" key={index} />
        ))}
      </div>
      <AccountSection>
        <div className="grid gap-3">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton className="h-32" key={index} />
          ))}
        </div>
      </AccountSection>
    </div>
  );
}

function normalizeAddressForm(input: CreateCustomerAddressInput) {
  return {
    ...input,
    addressLine2: input.addressLine2?.trim() ? input.addressLine2 : null,
    landmark: input.landmark?.trim() ? input.landmark : null
  };
}

function toFieldErrors(
  errors: Record<string, string[] | undefined>
): AddressFieldErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, messages?.[0]])
  ) as AddressFieldErrors;
}

function formatAddressType(type: CustomerAddressType) {
  return type
    .toLowerCase()
    .replace(/^\w/, (character) => character.toUpperCase());
}
