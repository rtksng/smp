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
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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
      <Card>
        <CardContent className="p-6">
          <PageHeader
            actions={
              <div className="actionRow">
                <Button
                  className="iconTextButton"
                  onClick={() => void refreshSettings()}
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden size={16} />
                  <span>Refresh</span>
                </Button>
                <Button className="iconTextButton" onClick={startCreate} type="button">
                  <Plus aria-hidden size={16} />
                  <span>New admin</span>
                </Button>
              </div>
            }
            eyebrow="Settings"
            summary="Manage admin users, role assignments, and permission visibility from one surface."
            title="Admin access control"
          />

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError || loadError ? (
          <p className="formError" role="alert">
            {mutationError ?? loadError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <MetricCard label="Admin users" tone="primary" value={pagination?.total ?? adminUsers.length} />
          <MetricCard label="Active visible" tone="primary" value={activeUserCount} />
          <MetricCard label="Suspended visible" tone="warning" value={suspendedUserCount} />
          <MetricCard label="Roles" value={roles.length} />
          <MetricCard label="Permissions" value={permissions.length} />
        </div>
        </CardContent>
      </Card>

      <section className="panel">
        <PageHeader eyebrow="Filters" level={2} title="Find admin users" />
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
          <PageHeader eyebrow="Admin users" level={2} title="Accounts and access" />

          {adminUsersQuery.isLoading ? (
            <LoadingState label="Loading admin users..." />
          ) : null}
          {!adminUsersQuery.isLoading && adminUsers.length === 0 ? (
            <EmptyState
              body="No admin users match the current filters."
              title="No admin users found"
            />
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
              onChange={setPage}
              page={pagination.page}
              totalPages={Math.max(pagination.totalPages, 1)}
            />
          ) : null}
        </section>

        <section className="panel">
          <PageHeader
            actions={
              editingUser ? (
                <Button
                  className="iconTextButton"
                  onClick={startCreate}
                  type="button"
                  variant="outline"
                >
                  <X aria-hidden size={16} />
                  <span>Clear</span>
                </Button>
              ) : null
            }
            eyebrow={editingUser ? "Edit admin" : "Create admin"}
            level={2}
            title={editingUser ? getAdminUserName(editingUser) : "New admin user"}
          />

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
        <PageHeader eyebrow="Roles" level={2} title="Permission sets" />

        {rolesQuery.isLoading ? (
          <LoadingState label="Loading roles..." />
        ) : null}
        {roles.length === 0 && !rolesQuery.isLoading ? (
          <EmptyState body="No roles are configured." title="No roles found" />
        ) : null}
        {roles.length > 0 ? <RoleList roles={roles} /> : null}
      </section>

      <section className="panel">
        <PageHeader eyebrow="Permissions" level={2} title="Permission catalog" />

        {permissionsQuery.isLoading ? (
          <LoadingState label="Loading permissions..." />
        ) : null}
        {permissions.length === 0 && !permissionsQuery.isLoading ? (
          <EmptyState
            body="No permissions are configured."
            title="No permissions found"
          />
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
        <Input
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Name, email, mobile"
          value={filters.search}
        />
      </label>
      <Select
        aria-label="Role"
        onValueChange={(value) => onChange({ ...filters, roleCode: value })}
        value={filters.roleCode}
      >
        <SelectTrigger>
          <SelectValue placeholder="Any role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any</SelectItem>
          {roles.map((role) => (
            <SelectItem key={role.id} value={role.code}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        aria-label="Status"
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value as AdminUserFilters["status"]
          })
        }
        value={filters.status}
      >
        <SelectTrigger>
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any</SelectItem>
          {ADMIN_USER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {formatAdminStatus(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="productFilterActions">
        <Button className="iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>Apply</span>
        </Button>
        <Button onClick={onReset} type="button" variant="outline">
          Reset
        </Button>
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
  return (
    <div className="resourceTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Admin</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
      {users.map((user) => (
        <TableRow key={user.id}>
          <TableCell>
            <strong>{getAdminUserName(user)}</strong>
            <em>{user.mobileNumber ?? "No mobile number"}</em>
          </TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role.name}</TableCell>
          <TableCell>
            <StatusBadge status={user.status} />
          </TableCell>
          <TableCell>
            {user.lastLoginAt ? formatDate(user.lastLoginAt) : "-"}
          </TableCell>
          <TableCell>
            <div className="tableActions">
            <Button
              className="iconTextButton"
              onClick={() => onEdit(user)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Pencil aria-hidden size={16} />
              <span>Edit</span>
            </Button>
            <Button
              className="iconTextButton"
              disabled={isDeleting || user.id === currentAdminId}
              onClick={() => onDelete(user)}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Trash2 aria-hidden size={16} />
              <span>Delete</span>
            </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
        </TableBody>
      </Table>
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
          <Select
            aria-label="Role"
            onValueChange={(value) => onValueChange("roleId", value)}
            value={values.roleId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.roleId ? <span className="fieldError">{errors.roleId}</span> : null}
        </label>
        <label>
          Status
          <Select
            aria-label="Status"
            onValueChange={(value) =>
              onValueChange("status", value as AdminUserFormValues["status"])
            }
            value={values.status}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_USER_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatAdminStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Button
          className="iconTextButton"
          disabled={isSaving || roles.length === 0}
          type="submit"
        >
          <CheckCircle2 aria-hidden size={16} />
          <span>{isSaving ? "Saving..." : "Save admin user"}</span>
        </Button>
      </div>
    </form>
  );
}

function RoleList({ roles }: { roles: AdminRole[] }) {
  return (
    <div className="roleGrid">
      {roles.map((role) => (
        <Card className="roleCard" key={role.id}>
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
        </Card>
      ))}
    </div>
  );
}

function PermissionList({ permissions }: { permissions: AdminPermission[] }) {
  return (
    <div className="resourceTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
      {permissions.map((permission) => (
        <TableRow key={permission.id}>
          <TableCell>
            <KeyRound aria-hidden size={14} />
            {permission.code}
          </TableCell>
          <TableCell>{permission.name}</TableCell>
          <TableCell>{permission.description ?? "-"}</TableCell>
        </TableRow>
      ))}
        </TableBody>
      </Table>
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
      <Input
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
