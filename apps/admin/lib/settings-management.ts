import { z } from "zod";
import type { QueryParams } from "./admin-api";

export const ADMIN_USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];

export type AdminRole = {
  code: string;
  description: string | null;
  id: string;
  isSystem: boolean;
  name: string;
  permissions: AdminPermission[];
};

export type AdminPermission = {
  code: string;
  description: string | null;
  id: string;
  name: string;
};

export type AdminUser = {
  createdAt: string;
  email: string;
  firstName: string;
  id: string;
  lastLoginAt: string | null;
  lastName: string | null;
  mobileNumber: string | null;
  role: {
    code: string;
    id: string;
    name: string;
  };
  roleId: string;
  status: AdminUserStatus;
  updatedAt: string;
};

export type AdminUserListResponse = {
  items: AdminUser[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export type AdminUserFilters = {
  roleCode: string;
  search: string;
  status: "" | AdminUserStatus;
};

const optionalPhonePattern = /^\+[1-9]\d{7,14}$/;

const requiredText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} is too long.`);

const optionalText = (label: string, maxLength: number) =>
  z.string().trim().max(maxLength, `${label} is too long.`);

export const adminUserFormSchema = z.object({
  email: requiredText("Email", 254).email("Enter a valid email."),
  firstName: requiredText("First name", 120),
  lastName: optionalText("Last name", 120),
  mobileNumber: z
    .string()
    .trim()
    .refine((value) => value === "" || optionalPhonePattern.test(value), {
      message: "Mobile number must include country code, for example +919876543210."
    }),
  password: z
    .string()
    .trim()
    .refine((value) => value === "" || value.length >= 8, {
      message: "Password must be at least 8 characters."
    })
    .refine((value) => value.length <= 128, {
      message: "Password is too long."
    }),
  roleId: requiredText("Role", 120),
  status: z.enum(ADMIN_USER_STATUSES)
});

export type AdminUserFormValues = z.input<typeof adminUserFormSchema>;
export type ParsedAdminUserFormValues = z.output<typeof adminUserFormSchema>;

export function createEmptyAdminUserFilters(): AdminUserFilters {
  return {
    roleCode: "",
    search: "",
    status: ""
  };
}

export function createEmptyAdminUserFormValues(): AdminUserFormValues {
  return {
    email: "",
    firstName: "",
    lastName: "",
    mobileNumber: "",
    password: "",
    roleId: "",
    status: "ACTIVE"
  };
}

export function buildAdminUsersQuery(
  filters: AdminUserFilters,
  page = 1,
  limit = 50
): QueryParams {
  return {
    limit,
    page,
    roleCode: filters.roleCode || undefined,
    search: filters.search.trim() || undefined,
    status: filters.status || undefined
  };
}

export function adminUserToFormValues(user: AdminUser): AdminUserFormValues {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? "",
    mobileNumber: user.mobileNumber ?? "",
    password: "",
    roleId: user.roleId,
    status: user.status
  };
}

export function buildAdminUserPayload(
  values: ParsedAdminUserFormValues,
  mode: "create" | "update"
): {
  email: string;
  firstName: string;
  lastName: string | null;
  mobileNumber: string | null;
  password?: string;
  roleId: string;
  status: AdminUserStatus;
} {
  return {
    email: values.email.trim().toLowerCase(),
    firstName: values.firstName.trim(),
    lastName: blankToNull(values.lastName),
    mobileNumber: blankToNull(values.mobileNumber),
    ...(values.password || mode === "create"
      ? {
          password: values.password
        }
      : {}),
    roleId: values.roleId,
    status: values.status
  };
}

export function formatPermissionCode(code: string) {
  return code
    .split(".")
    .map((part) =>
      part
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    )
    .join(" ");
}

export function formatAdminStatus(status: AdminUserStatus | string) {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function blankToNull(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}
