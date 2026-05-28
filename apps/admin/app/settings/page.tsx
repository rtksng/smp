"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AdminShell } from "../admin-shell";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "../_components/confirmation-dialog";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  ADMIN_USER_STATUSES,
  adminUserFormSchema,
  adminUserToFormValues,
  buildAdminUserPayload,
  buildAdminUsersQuery,
  createEmptyAdminUserFilters,
  createEmptyAdminUserFormValues,
  formatAdminStatus,
  formatPermissionCode,
  type AdminPermission,
  type AdminRole,
  type AdminUser,
  type AdminUserFilters,
  type AdminUserFormValues,
  type AdminUserListResponse
} from "../../lib/settings-management";

type AdminUserFieldErrors = Partial<Record<keyof AdminUserFormValues, string>>;

export default function SettingsPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        <SettingsContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function SettingsContent() {
  const { admin, api } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<AdminUserFilters>(
    createEmptyAdminUserFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<AdminUserFilters>(
    createEmptyAdminUserFilters()
  );
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formValues, setFormValues] = useState<AdminUserFormValues>(
    createEmptyAdminUserFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<AdminUserFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const rolesQuery = useQuery({
    queryFn: () => api.request<AdminRole[]>("/admin/roles"),
    queryKey: ["admin", "roles"]
  });
  const permissionsQuery = useQuery({
    queryFn: () => api.request<AdminPermission[]>("/admin/permissions"),
    queryKey: ["admin", "permissions"]
  });
  const adminUsersQuery = useQuery({
    queryFn: () =>
      api.request<AdminUserListResponse>("/admin/admin-users", {
        query: buildAdminUsersQuery(appliedFilters, page)
      }),
    queryKey: ["admin", "admin-users", appliedFilters, page]
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildAdminUserPayload>) =>
      api.request<AdminUser>("/admin/admin-users", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload
    }: {
      id: string;
      payload: ReturnType<typeof buildAdminUserPayload>;
    }) =>
      api.request<AdminUser>(`/admin/admin-users/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<void>(`/admin/admin-users/${id}`, {
        method: "DELETE"
      })
  });

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const adminUsers = useMemo(
    () => adminUsersQuery.data?.items ?? [],
    [adminUsersQuery.data?.items]
  );
  const pagination = adminUsersQuery.data?.pagination;
  const activeUserCount = adminUsers.filter((user) => user.status === "ACTIVE").length;
  const suspendedUserCount = adminUsers.filter(
    (user) => user.status === "SUSPENDED"
  ).length;
  const mutationError =
    getErrorMessage(createMutation.error) ??
    getErrorMessage(updateMutation.error) ??
    getErrorMessage(deleteMutation.error);
  const loadError =
    getErrorMessage(rolesQuery.error) ??
    getErrorMessage(permissionsQuery.error) ??
    getErrorMessage(adminUsersQuery.error);
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  async function refreshSettings() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "permissions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] })
    ]);
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    const emptyFilters = createEmptyAdminUserFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  function startCreate() {
    setEditingUser(null);
    setFormValues({
      ...createEmptyAdminUserFormValues(),
      roleId: roles[0]?.id ?? ""
    });
    setFieldErrors({});
    setMessage(null);
  }

  function startEdit(user: AdminUser) {
    setEditingUser(user);
    setFormValues(adminUserToFormValues(user));
    setFieldErrors({});
    setMessage(null);
  }

  function updateValue<Key extends keyof AdminUserFormValues>(
    key: Key,
    value: AdminUserFormValues[Key]
  ) {
    setFormValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = adminUserFormSchema.safeParse(formValues);

    if (!parsed.success) {
      setFieldErrors(getFieldErrors<AdminUserFormValues>(parsed.error));
      return;
    }

    if (!editingUser && parsed.data.password.trim().length === 0) {
      setFieldErrors({
        password: "Password is required for new admin users."
      });
      return;
    }

    setFieldErrors({});
    setMessage(null);
    const payload = buildAdminUserPayload(
      parsed.data,
      editingUser ? "update" : "create"
    );
    const savedUser = editingUser
      ? await updateMutation.mutateAsync({
          id: editingUser.id,
          payload
        })
      : await createMutation.mutateAsync(payload);

    setEditingUser(savedUser);
    setFormValues(adminUserToFormValues(savedUser));
    setMessage(editingUser ? "Admin user updated." : "Admin user created.");
    await refreshSettings();
  }

  function requestDelete(user: AdminUser) {
    if (user.id === admin?.id) {
      return;
    }

    setConfirmation({
      body: `Soft delete ${getAdminUserName(user)} and revoke active admin sessions?`,
      confirmLabel: "Delete admin user",
      onConfirm: async () => {
        setMessage(null);
        await deleteMutation.mutateAsync(user.id);

        if (editingUser?.id === user.id) {
          startCreate();
        }

        setMessage("Admin user soft deleted.");
        await refreshSettings();
      },
      title: "Delete admin user"
    });
  }

  return (
    <>
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Settings</p>
            <h2>Admin access control</h2>
            <p className="panelSummary">
              Manage admin users, role assignments, and permission visibility from one
              surface.
            </p>
          </div>
          <div className="actionRow">
            <button
              className="ghostButton iconTextButton"
              onClick={() => void refreshSettings()}
              type="button"
            >
              <RefreshCw aria-hidden size={16} />
              <span>Refresh</span>
            </button>
            <button
              className="primaryButton iconTextButton"
              onClick={startCreate}
              type="button"
            >
              <Plus aria-hidden size={16} />
              <span>New admin</span>
            </button>
          </div>
        </div>

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError || loadError ? (
          <p className="formError" role="alert">
            {mutationError ?? loadError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <article className="metric metric--primary">
            <span>Admin users</span>
            <strong>{pagination?.total ?? adminUsers.length}</strong>
          </article>
          <article className="metric metric--primary">
            <span>Active visible</span>
            <strong>{activeUserCount}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Suspended visible</span>
            <strong>{suspendedUserCount}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Roles</span>
            <strong>{roles.length}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Permissions</span>
            <strong>{permissions.length}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Find admin users</h2>
          </div>
        </div>
        <AdminUserFilterForm
          filters={draftFilters}
          onChange={setDraftFilters}
          onReset={resetFilters}
          onSubmit={applyFilters}
          roles={roles}
        />
      </section>

      <div className="settingsManagementGrid">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Admin users</p>
              <h2>Accounts and access</h2>
            </div>
          </div>

          {adminUsersQuery.isLoading ? (
            <div className="loadingBlock">Loading admin users...</div>
          ) : null}
          {!adminUsersQuery.isLoading && adminUsers.length === 0 ? (
            <div className="emptyPanel smallEmpty">
              No admin users match the current filters.
            </div>
          ) : null}
          {adminUsers.length > 0 ? (
            <AdminUsersTable
              currentAdminId={admin?.id ?? null}
              isDeleting={deleteMutation.isPending}
              onDelete={requestDelete}
              onEdit={startEdit}
              users={adminUsers}
            />
          ) : null}
          {pagination ? (
            <PaginationControls
              hasNextPage={pagination.hasNextPage}
              hasPreviousPage={pagination.hasPreviousPage}
              label={`Page ${pagination.page} of ${Math.max(pagination.totalPages, 1)}`}
              onNext={() => setPage((current) => current + 1)}
              onPrevious={() => setPage((current) => Math.max(current - 1, 1))}
            />
          ) : null}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">{editingUser ? "Edit admin" : "Create admin"}</p>
              <h2>{editingUser ? getAdminUserName(editingUser) : "New admin user"}</h2>
            </div>
            {editingUser ? (
              <button
                className="ghostButton iconTextButton"
                onClick={startCreate}
                type="button"
              >
                <X aria-hidden size={16} />
                <span>Clear</span>
              </button>
            ) : null}
          </div>

          <AdminUserForm
            errors={fieldErrors}
            isSaving={createMutation.isPending || updateMutation.isPending}
            mode={editingUser ? "update" : "create"}
            onSubmit={handleSubmit}
            onValueChange={updateValue}
            roles={roles}
            values={formValues}
          />
        </section>
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Roles</p>
            <h2>Permission sets</h2>
          </div>
        </div>

        {rolesQuery.isLoading ? (
          <div className="loadingBlock">Loading roles...</div>
        ) : null}
        {roles.length === 0 && !rolesQuery.isLoading ? (
          <div className="emptyPanel smallEmpty">No roles are configured.</div>
        ) : null}
        {roles.length > 0 ? <RoleList roles={roles} /> : null}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Permissions</p>
            <h2>Permission catalog</h2>
          </div>
        </div>

        {permissionsQuery.isLoading ? (
          <div className="loadingBlock">Loading permissions...</div>
        ) : null}
        {permissions.length === 0 && !permissionsQuery.isLoading ? (
          <div className="emptyPanel smallEmpty">No permissions are configured.</div>
        ) : null}
        {permissions.length > 0 ? <PermissionList permissions={permissions} /> : null}
      </section>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isMutating}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function AdminUserFilterForm({
  filters,
  onChange,
  onReset,
  onSubmit,
  roles
}: {
  filters: AdminUserFilters;
  onChange: (filters: AdminUserFilters) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  roles: AdminRole[];
}) {
  return (
    <form className="productFilters settingsFilters" onSubmit={onSubmit}>
      <label>
        Search
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <input
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Name, email, mobile"
            value={filters.search}
          />
        </span>
      </label>
      <label>
        Role
        <select
          onChange={(event) => onChange({ ...filters, roleCode: event.target.value })}
          value={filters.roleCode}
        >
          <option value="">Any</option>
          {roles.map((role) => (
            <option key={role.id} value={role.code}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as AdminUserFilters["status"]
            })
          }
          value={filters.status}
        >
          <option value="">Any</option>
          {ADMIN_USER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatAdminStatus(status)}
            </option>
          ))}
        </select>
      </label>
      <div className="productFilterActions">
        <button className="primaryButton iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>Apply</span>
        </button>
        <button className="ghostButton" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </form>
  );
}

function AdminUsersTable({
  currentAdminId,
  isDeleting,
  onDelete,
  onEdit,
  users
}: {
  currentAdminId: string | null;
  isDeleting: boolean;
  onDelete: (user: AdminUser) => void;
  onEdit: (user: AdminUser) => void;
  users: AdminUser[];
}) {
  const gridTemplateColumns =
    "minmax(220px, 1.2fr) minmax(220px, 1.2fr) minmax(170px, 0.8fr) 120px minmax(140px, 0.7fr) 190px";

  return (
    <div className="resourceTable" role="table">
      <div className="resourceTableHeader" role="row" style={{ gridTemplateColumns }}>
        <strong role="columnheader">Admin</strong>
        <strong role="columnheader">Email</strong>
        <strong role="columnheader">Role</strong>
        <strong role="columnheader">Status</strong>
        <strong role="columnheader">Last login</strong>
        <strong role="columnheader">Actions</strong>
      </div>
      {users.map((user) => (
        <div
          className="resourceTableRow"
          key={user.id}
          role="row"
          style={{ gridTemplateColumns }}
        >
          <span role="cell">
            <strong>{getAdminUserName(user)}</strong>
            <em>{user.mobileNumber ?? "No mobile number"}</em>
          </span>
          <span role="cell">{user.email}</span>
          <span role="cell">{user.role.name}</span>
          <span role="cell">
            <span className={`statusBadge statusBadge--${user.status.toLowerCase()}`}>
              {formatAdminStatus(user.status)}
            </span>
          </span>
          <span role="cell">
            {user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}
          </span>
          <span className="tableActions" role="cell">
            <button
              className="ghostButton iconTextButton"
              onClick={() => onEdit(user)}
              type="button"
            >
              <Pencil aria-hidden size={16} />
              <span>Edit</span>
            </button>
            <button
              className="dangerButton iconTextButton"
              disabled={isDeleting || user.id === currentAdminId}
              onClick={() => onDelete(user)}
              type="button"
            >
              <Trash2 aria-hidden size={16} />
              <span>Delete</span>
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function AdminUserForm({
  errors,
  isSaving,
  mode,
  onSubmit,
  onValueChange,
  roles,
  values
}: {
  errors: AdminUserFieldErrors;
  isSaving: boolean;
  mode: "create" | "update";
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onValueChange: <Key extends keyof AdminUserFormValues>(
    key: Key,
    value: AdminUserFormValues[Key]
  ) => void;
  roles: AdminRole[];
  values: AdminUserFormValues;
}) {
  return (
    <form className="formStack productForm" onSubmit={onSubmit}>
      <div className="formGrid">
        <TextField
          error={errors.firstName}
          label="First name"
          onChange={(value) => onValueChange("firstName", value)}
          value={values.firstName}
        />
        <TextField
          error={errors.lastName}
          label="Last name"
          onChange={(value) => onValueChange("lastName", value)}
          required={false}
          value={values.lastName}
        />
        <TextField
          error={errors.email}
          inputMode="email"
          label="Email"
          onChange={(value) => onValueChange("email", value)}
          value={values.email}
        />
        <TextField
          error={errors.mobileNumber}
          inputMode="tel"
          label="Mobile number"
          onChange={(value) => onValueChange("mobileNumber", value)}
          required={false}
          value={values.mobileNumber}
        />
        <label>
          Role
          <select
            onChange={(event) => onValueChange("roleId", event.target.value)}
            value={values.roleId}
          >
            <option value="">Select role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          {errors.roleId ? <span className="fieldError">{errors.roleId}</span> : null}
        </label>
        <label>
          Status
          <select
            onChange={(event) =>
              onValueChange(
                "status",
                event.target.value as AdminUserFormValues["status"]
              )
            }
            value={values.status}
          >
            {ADMIN_USER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatAdminStatus(status)}
              </option>
            ))}
          </select>
          {errors.status ? <span className="fieldError">{errors.status}</span> : null}
        </label>
        <TextField
          error={errors.password}
          label={mode === "create" ? "Password" : "New password"}
          onChange={(value) => onValueChange("password", value)}
          required={mode === "create"}
          type="password"
          value={values.password}
        />
      </div>
      <div className="actionRow">
        <button
          className="primaryButton iconTextButton"
          disabled={isSaving || roles.length === 0}
          type="submit"
        >
          <CheckCircle2 aria-hidden size={16} />
          <span>{isSaving ? "Saving..." : "Save admin user"}</span>
        </button>
      </div>
    </form>
  );
}

function RoleList({ roles }: { roles: AdminRole[] }) {
  return (
    <div className="roleGrid">
      {roles.map((role) => (
        <article className="roleCard" key={role.id}>
          <div className="roleCardHeader">
            <div>
              <strong>{role.name}</strong>
              <span>{role.code}</span>
            </div>
            {role.isSystem ? (
              <span className="statusBadge statusBadge--active">System</span>
            ) : null}
          </div>
          {role.description ? <p>{role.description}</p> : null}
          <div className="flagList">
            {role.permissions.map((permission) => (
              <b key={permission.id}>{formatPermissionCode(permission.code)}</b>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function PermissionList({ permissions }: { permissions: AdminPermission[] }) {
  return (
    <div className="resourceTable" role="table">
      <div
        className="resourceTableHeader"
        role="row"
        style={{
          gridTemplateColumns:
            "minmax(200px, 0.8fr) minmax(220px, 1fr) minmax(260px, 1.2fr)"
        }}
      >
        <strong role="columnheader">Code</strong>
        <strong role="columnheader">Name</strong>
        <strong role="columnheader">Description</strong>
      </div>
      {permissions.map((permission) => (
        <div
          className="resourceTableRow"
          key={permission.id}
          role="row"
          style={{
            gridTemplateColumns:
              "minmax(200px, 0.8fr) minmax(220px, 1fr) minmax(260px, 1.2fr)"
          }}
        >
          <span role="cell">
            <KeyRound aria-hidden size={14} />
            {permission.code}
          </span>
          <span role="cell">{permission.name}</span>
          <span role="cell">{permission.description ?? "-"}</span>
        </div>
      ))}
    </div>
  );
}

function PaginationControls({
  hasNextPage,
  hasPreviousPage,
  label,
  onNext,
  onPrevious
}: {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  label: string;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="paginationBar">
      <button
        className="ghostButton"
        disabled={!hasPreviousPage}
        onClick={onPrevious}
        type="button"
      >
        Previous
      </button>
      <span>{label}</span>
      <button
        className="ghostButton"
        disabled={!hasNextPage}
        onClick={onNext}
        type="button"
      >
        Next
      </button>
    </div>
  );
}

function TextField({
  error,
  inputMode,
  label,
  onChange,
  required = true,
  type = "text",
  value
}: {
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  value: string;
}) {
  return (
    <label>
      {label}
      <input
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function getAdminUserName(user: AdminUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function getFieldErrors<TFields extends Record<string, unknown>>(error: z.ZodError) {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const errors: Partial<Record<keyof TFields, string>> = {};

  for (const [field, messages] of Object.entries(flattened)) {
    if (messages?.[0]) {
      errors[field as keyof TFields] = messages[0];
    }
  }

  return errors;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
