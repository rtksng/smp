"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import { createUpdateProfileMutation } from "../../lib/api/mutation-helpers";
import { customerQueryKeys } from "../../lib/api/query-keys";
import {
  getCustomerProfile,
  updateCustomerProfileInputSchema,
  type CustomerProfileDetails,
  type UpdateCustomerProfileInput
} from "../../lib/api/customer-profile";
import { Button } from "../ui/button";
import { ErrorState, RetryButton } from "../ui/error-state";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import {
  AccountInfoGrid,
  AccountSection,
  AccountSectionHeader,
  CustomerAccountShell
} from "./customer-account-shell";

type ProfileFormState = {
  businessName: string;
  email: string;
  gstNumber: string;
  name: string;
};

type ProfileFieldErrors = Partial<Record<keyof ProfileFormState, string>>;

const emptyProfileForm: ProfileFormState = {
  businessName: "",
  email: "",
  gstNumber: "",
  name: ""
};

export function AccountProfile() {
  return (
    <CustomerAccountShell
      activePath="/account/profile"
      description="Keep billing and customer details current for orders and invoices."
      title="Profile"
    >
      <AccountProfileContent />
    </CustomerAccountShell>
  );
}

export function AccountProfileContent() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryFn: getCustomerProfile,
    queryKey: customerQueryKeys.profile()
  });
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] =
    useState<ProfileFormState>(emptyProfileForm);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const updateProfileMutation = useMutation(
    createUpdateProfileMutation({
      queryClient,
      onSuccess: (profile) => {
        setProfileForm(toProfileForm(profile));
        setLoadedProfileId(profile.id);
        setFieldErrors({});
        setSubmitError(null);
        setSuccessMessage("Profile updated.");
      }
    })
  );

  useEffect(() => {
    const profile = profileQuery.data;

    if (!profile || loadedProfileId === profile.id) {
      return;
    }

    setProfileForm(toProfileForm(profile));
    setLoadedProfileId(profile.id);
  }, [loadedProfileId, profileQuery.data]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);

    const parsedInput = updateCustomerProfileInputSchema.safeParse(
      toProfileInput(profileForm)
    );

    if (!parsedInput.success) {
      setFieldErrors(toFieldErrors(parsedInput.error.flatten().fieldErrors));
      return;
    }

    try {
      await updateProfileMutation.mutateAsync(parsedInput.data);
    } catch (error) {
      setSubmitError(
        getFriendlyApiErrorMessage(error, "Unable to update profile.")
      );
    }
  }

  return (
    <>
      {profileQuery.isLoading ? <ProfileSkeleton /> : null}

      {profileQuery.isError ? (
        <ErrorState
          action={<RetryButton onRetry={() => profileQuery.refetch()} />}
          message={getFriendlyApiErrorMessage(
            profileQuery.error,
            "Unable to load profile."
          )}
          title="Unable to load profile"
        />
      ) : null}

      {profileQuery.data ? (
        <>
          <AccountInfoGrid
            items={[
              { label: "Name", value: profileQuery.data.name },
              {
                label: "Mobile",
                value: profileQuery.data.mobileNumber
              },
              {
                label: "Email",
                value: profileQuery.data.email ?? "Not added"
              },
              {
                label: "GST",
                value: profileQuery.data.gstNumber ?? "Not added"
              }
            ]}
          />

          <AccountSection>
            <AccountSectionHeader
              description="Update billing identity, business name, email, and GST details used on invoices."
              title="Editable details"
            />
            <form className="mt-5 grid gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  error={fieldErrors.name}
                  label="Customer name"
                  name="name"
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  value={profileForm.name}
                />
                <Input
                  disabled
                  label="Mobile number"
                  name="mobileNumber"
                  value={profileQuery.data.mobileNumber}
                />
                <Input
                  error={fieldErrors.email}
                  label="Email"
                  name="email"
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      email: event.target.value
                    }))
                  }
                  placeholder="billing@example.com"
                  type="email"
                  value={profileForm.email}
                />
                <Input
                  error={fieldErrors.businessName}
                  label="Business name"
                  name="businessName"
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      businessName: event.target.value
                    }))
                  }
                  value={profileForm.businessName}
                />
                <Input
                  className="uppercase"
                  error={fieldErrors.gstNumber}
                  label="GST number"
                  name="gstNumber"
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      gstNumber: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder="27ABCDE1234F1Z5"
                  value={profileForm.gstNumber}
                />
              </div>

              {submitError ? (
                <p className="rounded-lg bg-[#fff5f5] px-4 py-3 text-sm font-semibold text-[#7a271a]">
                  {submitError}
                </p>
              ) : null}

              {successMessage ? (
                <p className="rounded-lg bg-[#e5f5f3] px-4 py-3 text-sm font-semibold text-[#0f6f68]">
                  {successMessage}
                </p>
              ) : null}

              <div>
                <Button
                  className="w-full sm:w-auto"
                  disabled={updateProfileMutation.isPending}
                  type="submit"
                >
                  <Save aria-hidden="true" className="h-4 w-4" />
                  {updateProfileMutation.isPending ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </form>
          </AccountSection>
        </>
      ) : null}
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-20" key={index} />
        ))}
      </div>
      <AccountSection>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="grid gap-2" key={index}>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </AccountSection>
    </div>
  );
}

function toProfileForm(profile: CustomerProfileDetails): ProfileFormState {
  return {
    businessName: profile.businessName ?? "",
    email: profile.email ?? "",
    gstNumber: profile.gstNumber ?? "",
    name: profile.name
  };
}

function toProfileInput(form: ProfileFormState): UpdateCustomerProfileInput {
  return {
    businessName: nullableString(form.businessName),
    email: nullableString(form.email),
    gstNumber: nullableString(form.gstNumber)?.toUpperCase() ?? null,
    name: form.name
  };
}

function nullableString(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function toFieldErrors(
  errors: Record<string, string[] | undefined>
): ProfileFieldErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, messages?.[0]])
  ) as ProfileFieldErrors;
}
