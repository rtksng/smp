"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { AdminShell } from "../../admin-shell";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
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
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import { notify } from "../../../lib/notifications";
import { ADMIN_PERMISSION, ADMIN_ROLE } from "../../../lib/permissions";
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
  type AdminRole,
  type AdminUser,
  type AdminUserFilters,
  type AdminUserFormValues,
  type AdminUserListResponse
} from "../../../lib/settings-management";
import "../settings-responsive.css";

type AdminUserFieldErrors = Partial<Record<keyof AdminUserFormValues, string>>;
type SettingsSectionId = "admin-users" | "roles";

const settingsSections: Array<{
  href: string;
  id: SettingsSectionId;
  title: string;
}> = [
  {
    href: "/settings/admin-users",
    id: "admin-users",
    title: "Admin users"
  },
  {
    href: "/settings/roles",
    id: "roles",
    title: "Roles"
  }
];

export function SettingsRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function SettingsAdminUsersPage() {
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
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const rolesQuery = useQuery({
    queryFn: () => api.request<AdminRole[]>("/admin/roles"),
    queryKey: ["admin", "roles"]
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
  const adminUsers = useMemo(
    () => adminUsersQuery.data?.items ?? [],
    [adminUsersQuery.data?.items]
  );
  const pagination = adminUsersQuery.data?.pagination;
  const activeUserCount = adminUsers.filter((user) => user.status === "ACTIVE").length;
  const suspendedUserCount = adminUsers.filter(
    (user) => user.status === "SUSPENDED"
  ).length;
  const loadError =
    getErrorMessage(rolesQuery.error) ?? getErrorMessage(adminUsersQuery.error);
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    if (loadError) {
      notify.error(loadError, { id: "settings-admin-users-load-error" });
    }
  }, [loadError]);

  async function refreshSettings() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] })
    ]);
  }

  async function handleRefresh() {
    try {
      await refreshSettings();
      notify.info("Settings refreshed.");
    } catch (error) {
      notify.error(getErrorMessage(error) ?? "Unable to refresh settings.");
    }
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
  }

  function startEdit(user: AdminUser) {
    setEditingUser(user);
    setFormValues(adminUserToFormValues(user));
    setFieldErrors({});
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
      notify.warning("Please fix the highlighted admin user fields.");
      return;
    }

    if (!editingUser && parsed.data.password.trim().length === 0) {
      setFieldErrors({
        password: "Password is required for new admin users."
      });
      notify.warning("Password is required for a new admin user.");
      return;
    }

    setFieldErrors({});
    const payload = buildAdminUserPayload(
      parsed.data,
      editingUser ? "update" : "create"
    );

    try {
      const isEditing = Boolean(editingUser);
      const savedUser = editingUser
        ? await updateMutation.mutateAsync({
            id: editingUser.id,
            payload
          })
        : await createMutation.mutateAsync(payload);

      setEditingUser(savedUser);
      setFormValues(adminUserToFormValues(savedUser));
      notify.success(isEditing ? "Admin user updated." : "Admin user created.");
      await refreshSettings();
    } catch (error) {
      notify.error(getErrorMessage(error) ?? "Unable to save the admin user.");
    }
  }

  function requestDelete(user: AdminUser) {
    if (user.id === admin?.id || user.role.code === ADMIN_ROLE.SuperAdmin) {
      notify.warning("This admin account cannot be deleted.");
      return;
    }

    setConfirmation({
      body: `Soft delete ${getAdminUserName(user)} and revoke active admin sessions?`,
      confirmLabel: "Delete admin user",
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(user.id);

          if (editingUser?.id === user.id) {
            startCreate();
          }

          notify.success("Admin user deleted.");
          await refreshSettings();
        } catch (error) {
          notify.error(getErrorMessage(error) ?? "Unable to delete the admin user.");
        }
      },
      title: "Delete admin user"
    });
  }

  return (
    <div
      className="settingsModule settingsAdminUsersModule"
      data-settings-view="admin-users"
    >
      <section className="panel settingsOverviewPanel">
        <SettingsSectionNav active="admin-users" />
        <PageHeader
          className="settingsPageHeader"
          actions={
            <div className="actionRow settingsHeaderActions">
              <Button
                className="iconTextButton"
                onClick={() => void handleRefresh()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
              <Button className="iconTextButton" onClick={startCreate} type="button">
                <Plus aria-hidden size={16} />
                <span>New User</span>
              </Button>
            </div>
          }
          eyebrow="Settings"
          summary="Create and maintain administrator accounts and assign predefined roles."
          title="Admin users"
        />

        <div className="metricGrid resourceMetrics settingsMetricGrid">
          <MetricCard
            label="Admin users"
            tone="primary"
            value={pagination?.total ?? adminUsers.length}
          />
          <MetricCard label="Active visible" tone="primary" value={activeUserCount} />
          <MetricCard
            label="Suspended visible"
            tone="warning"
            value={suspendedUserCount}
          />
          <MetricCard label="Roles available" value={roles.length} />
        </div>
      </section>

      <div className="settingsWorkspaceGrid">
        <section className="panel settingsUsersPanel">
          <PageHeader
            className="settingsSectionHeader"
            eyebrow="Admin users"
            level={2}
            summary="Search, filter, edit, or remove admin accounts from one table."
            title="Accounts and access"
          />

          <AdminUserFilterForm
            filters={draftFilters}
            onChange={setDraftFilters}
            onReset={resetFilters}
            onSubmit={applyFilters}
            roles={roles}
          />

          {adminUsersQuery.isLoading ? (
            <LoadingState label="Loading admin users..." />
          ) : null}
          {!adminUsersQuery.isLoading &&
          !adminUsersQuery.isError &&
          adminUsers.length === 0 ? (
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
              pageSize={pagination.limit}
              totalItems={pagination.total}
              totalPages={Math.max(pagination.totalPages, 1)}
            />
          ) : null}
        </section>

        <aside className="panel settingsFormPanel">
          <PageHeader
            className="settingsSectionHeader"
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
        </aside>
      </div>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isMutating}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </div>
  );
}

export function SettingsRolesPage() {
  const { api } = useAdminSession();
  const rolesQuery = useQuery({
    queryFn: () => api.request<AdminRole[]>("/admin/roles"),
    queryKey: ["admin", "roles"]
  });
  const roles = rolesQuery.data ?? [];
  const loadError = getErrorMessage(rolesQuery.error);
  const permissionCount = new Set(
    roles.flatMap((role) => role.permissions.map((permission) => permission.id))
  ).size;

  useEffect(() => {
    if (loadError) {
      notify.error(loadError, { id: "settings-roles-load-error" });
    }
  }, [loadError]);

  return (
    <div className="settingsModule settingsRolesModule" data-settings-view="roles">
      <section className="panel settingsOverviewPanel">
        <SettingsSectionNav active="roles" />
        <PageHeader
          className="settingsPageHeader"
          eyebrow="Settings"
          summary="Review the predefined roles available when assigning administrator access."
          title="Roles"
        />

        <div className="metricGrid resourceMetrics settingsMetricGrid">
          <MetricCard label="Roles" tone="primary" value={roles.length} />
          <MetricCard
            label="System roles"
            value={roles.filter((role) => role.isSystem).length}
          />
          <MetricCard
            label="Custom roles"
            value={roles.filter((role) => !role.isSystem).length}
          />
          <MetricCard label="Permissions used" value={permissionCount} />
        </div>
      </section>

      <section className="panel settingsRolesPanel">
        <PageHeader
          className="settingsSectionHeader"
          eyebrow="Roles"
          level={2}
          summary="Each row shows the role description and its assigned access."
          title="Predefined roles"
        />

        {rolesQuery.isLoading ? <LoadingState label="Loading roles..." /> : null}
        {roles.length === 0 && !rolesQuery.isLoading && !rolesQuery.isError ? (
          <EmptyState body="No roles are configured." title="No roles found" />
        ) : null}
        {roles.length > 0 ? <RoleList roles={roles} /> : null}
      </section>
    </div>
  );
}

function SettingsSectionNav({ active }: { active: SettingsSectionId }) {
  return (
    <nav className="settingsSectionNav" aria-label="Settings sections">
      {settingsSections.map((section) => (
        <Link
          aria-current={active === section.id ? "page" : undefined}
          href={section.href}
          key={section.id}
        >
          {section.title}
        </Link>
      ))}
    </nav>
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
      <label>
        Role
        <Select
          aria-label="Role"
          onValueChange={(value) => onChange({ ...filters, roleCode: value })}
          value={filters.roleCode}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any role</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.code}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label>
        Status
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
            <SelectItem value="">Any status</SelectItem>
            {ADMIN_USER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {formatAdminStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
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
    <div className="settingsTableShell settingsAdminUsersTableShell">
      <p className="settingsTableHint">
        Swipe sideways to view every admin user option.
      </p>
      <Table containerClassName="resourceTable settingsAdminUsersTable">
        <TableHeader>
          <TableRow>
            <TableHead>Admin</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead className="settingsAdminUsersActionsColumn">Actions</TableHead>
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
                <div className="tableActions settingsAdminUsersTableActions">
                  <Button
                    aria-label={`Edit ${getAdminUserName(user)}`}
                    className="tableIconButton"
                    onClick={() => onEdit(user)}
                    size="icon"
                    title="Edit"
                    type="button"
                    variant="outline"
                  >
                    <Pencil aria-hidden size={16} />
                  </Button>
                  {user.role.code !== ADMIN_ROLE.SuperAdmin ? (
                    <Button
                      aria-label={`Delete ${getAdminUserName(user)}`}
                      className="tableIconButton"
                      disabled={isDeleting || user.id === currentAdminId}
                      onClick={() => onDelete(user)}
                      size="icon"
                      title="Delete"
                      type="button"
                      variant="destructive"
                    >
                      <Trash2 aria-hidden size={16} />
                    </Button>
                  ) : null}
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
    <form className="formStack productForm settingsAdminUserForm" onSubmit={onSubmit}>
      <div className="formGrid settingsAdminUserFormGrid">
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
      <div className="actionRow settingsFormActions">
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
    <div className="settingsTableShell settingsRolesTableShell">
      <p className="settingsTableHint">
        Swipe sideways to view every role and permission.
      </p>
      <Table containerClassName="resourceTable rolePermissionTable settingsRolesTable">
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Permissions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell>
                <strong>{role.name}</strong>
                <em>{role.code}</em>
              </TableCell>
              <TableCell>
                {role.isSystem ? (
                  <span className="statusBadge statusBadge--active">System</span>
                ) : (
                  <span className="statusBadge statusBadge--draft">Custom</span>
                )}
              </TableCell>
              <TableCell>{role.description ?? "-"}</TableCell>
              <TableCell>
                <div className="flagList compactFlagList">
                  {role.permissions.map((permission) => (
                    <b key={permission.id}>{formatPermissionCode(permission.code)}</b>
                  ))}
                </div>
              </TableCell>
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
