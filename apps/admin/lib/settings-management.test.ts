import { describe, expect, it } from "vitest";
import {
  ADMIN_USER_STATUSES,
  adminUserFormSchema,
  adminUserToFormValues,
  buildAdminUserPayload,
  buildAdminUsersQuery,
  createEmptyAdminUserFilters,
  createEmptyAdminUserFormValues,
  formatPermissionCode,
  type AdminUser
} from "./settings-management";

const adminUser: AdminUser = {
  createdAt: "2026-05-25T10:00:00.000Z",
  email: "ops@example.com",
  firstName: "Ops",
  id: "admin-1",
  lastLoginAt: null,
  lastName: "Manager",
  mobileNumber: "+919876543210",
  role: {
    code: "ORDER_MANAGER",
    id: "role-1",
    name: "Order manager"
  },
  roleId: "role-1",
  status: "ACTIVE",
  updatedAt: "2026-05-25T10:00:00.000Z"
};

describe("settings management helpers", () => {
  it("normalizes admin user create payloads", () => {
    const parsed = adminUserFormSchema.parse({
      ...createEmptyAdminUserFormValues(),
      email: " OPS@EXAMPLE.COM ",
      firstName: " Ops ",
      lastName: "",
      mobileNumber: "",
      password: "StrongPass123",
      roleId: "role-1",
      status: "ACTIVE"
    });

    expect(buildAdminUserPayload(parsed, "create")).toEqual({
      email: "ops@example.com",
      firstName: "Ops",
      lastName: null,
      mobileNumber: null,
      password: "StrongPass123",
      roleId: "role-1",
      status: "ACTIVE"
    });
  });

  it("allows blank passwords while editing admin users", () => {
    const parsed = adminUserFormSchema.parse({
      ...adminUserToFormValues(adminUser),
      password: ""
    });

    expect(buildAdminUserPayload(parsed, "update")).not.toHaveProperty("password");
  });

  it("builds admin user list filters and display labels", () => {
    expect(
      buildAdminUsersQuery({
        ...createEmptyAdminUserFilters(),
        roleCode: "ORDER_MANAGER",
        search: "ops",
        status: ADMIN_USER_STATUSES[0]
      })
    ).toEqual({
      limit: 50,
      page: 1,
      roleCode: "ORDER_MANAGER",
      search: "ops",
      status: "ACTIVE"
    });
    expect(formatPermissionCode("warehouse.staff.manage")).toBe(
      "Warehouse Staff Manage"
    );
  });
});
