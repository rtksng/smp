"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  UserPlus,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AdminShell } from "../admin-shell";
import { ConfirmationDialog, type ConfirmationState } from "../_components/confirmation-dialog";
import {
  PermissionGate,
  ProtectedRoute,
  useAdminSession
} from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  WAREHOUSE_STATUSES,
  buildWarehousePayload,
  buildWarehouseQuery,
  createEmptyWarehouseFilters,
  createEmptyWarehouseFormValues,
  formatWarehouseStatus,
  getWarehouseStatusAction,
  warehouseFormSchema,
  warehouseStaffFormSchema,
  warehouseToFormValues,
  type AdminWarehouse,
  type WarehouseFilters,
  type WarehouseFormValues,
  type WarehouseListResponse,
  type WarehouseStaffAssignment,
  type WarehouseStatus
} from "../../lib/warehouse-management";

type WarehouseFieldErrors = Partial<Record<keyof WarehouseFormValues, string>>;

export default function WarehousesPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.WarehouseRead}>
        <WarehousesContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function WarehousesContent() {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<WarehouseFilters>(
    createEmptyWarehouseFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<WarehouseFilters>(
    createEmptyWarehouseFilters()
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<WarehouseFormValues>(
    createEmptyWarehouseFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<WarehouseFieldErrors>({});
  const [staffAdminUserId, setStaffAdminUserId] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const canManage = hasPermission(ADMIN_PERMISSION.WarehouseManage);
  const canManageStaff = hasPermission(ADMIN_PERMISSION.WarehouseStaffManage);

  const warehousesQuery = useQuery({
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: buildWarehouseQuery(appliedFilters)
      }),
    queryKey: ["admin", "warehouses", appliedFilters]
  });

  const warehouseDetailQuery = useQuery({
    enabled: Boolean(selectedWarehouseId),
    queryFn: () => api.request<AdminWarehouse>(`/admin/warehouses/${selectedWarehouseId ?? ""}`),
    queryKey: ["admin", "warehouses", selectedWarehouseId]
  });

  const staffQuery = useQuery({
    enabled: Boolean(selectedWarehouseId && canManageStaff),
    queryFn: () =>
      api.request<WarehouseStaffAssignment[]>(
        `/admin/warehouses/${selectedWarehouseId ?? ""}/staff`
      ),
    queryKey: ["admin", "warehouses", selectedWarehouseId, "staff"]
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildWarehousePayload>) =>
      api.request<AdminWarehouse>("/admin/warehouses", {
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
      payload: ReturnType<typeof buildWarehousePayload>;
    }) =>
      api.request<AdminWarehouse>(`/admin/warehouses/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const statusMutation = useMutation({
    mutationFn: ({ action, id }: { action: "activate" | "deactivate"; id: string }) =>
      api.request<AdminWarehouse>(`/admin/warehouses/${id}/${action}`, {
        method: "PATCH"
      })
  });
  const assignStaffMutation = useMutation({
    mutationFn: ({ adminUserId, warehouseId }: { adminUserId: string; warehouseId: string }) =>
      api.request<WarehouseStaffAssignment>(`/admin/warehouses/${warehouseId}/staff`, {
        body: JSON.stringify({ adminUserId }),
        method: "POST"
      })
  });
  const removeStaffMutation = useMutation({
    mutationFn: ({ adminUserId, warehouseId }: { adminUserId: string; warehouseId: string }) =>
      api.request<void>(`/admin/warehouses/${warehouseId}/staff/${adminUserId}`, {
        method: "DELETE"
      })
  });

  const warehouses = useMemo(
    () => warehousesQuery.data?.items ?? [],
    [warehousesQuery.data?.items]
  );
  const selectedWarehouse =
    warehouseDetailQuery.data ??
    warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ??
    null;
  const activeCount = warehouses.filter((warehouse) => warehouse.status === "ACTIVE").length;
  const inactiveCount = warehouses.filter(
    (warehouse) => warehouse.status === "INACTIVE"
  ).length;
  const mutationError =
    getErrorMessage(createMutation.error) ??
    getErrorMessage(updateMutation.error) ??
    getErrorMessage(statusMutation.error) ??
    getErrorMessage(assignStaffMutation.error) ??
    getErrorMessage(removeStaffMutation.error);
  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    statusMutation.isPending ||
    assignStaffMutation.isPending ||
    removeStaffMutation.isPending;

  useEffect(() => {
    if (warehouses.length === 0) {
      setSelectedWarehouseId(null);
      return;
    }

    if (!selectedWarehouseId || !warehouses.some((warehouse) => warehouse.id === selectedWarehouseId)) {
      setSelectedWarehouseId(warehouses[0]?.id ?? null);
    }
  }, [selectedWarehouseId, warehouses]);

  async function refreshWarehouses() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    const emptyFilters = createEmptyWarehouseFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  function selectWarehouse(warehouse: AdminWarehouse) {
    setSelectedWarehouseId(warehouse.id);
    setEditingWarehouseId(null);
    setFormValues(createEmptyWarehouseFormValues());
    setFieldErrors({});
    setMessage(null);
  }

  function startCreate() {
    setEditingWarehouseId(null);
    setFormValues(createEmptyWarehouseFormValues());
    setFieldErrors({});
    setMessage(null);
  }

  function startEdit(warehouse: AdminWarehouse) {
    setSelectedWarehouseId(warehouse.id);
    setEditingWarehouseId(warehouse.id);
    setFormValues(warehouseToFormValues(warehouse));
    setFieldErrors({});
    setMessage(null);
  }

  function requestStatusChange(warehouse: AdminWarehouse, action: "activate" | "deactivate") {
    if (action === "deactivate") {
      setConfirmation({
        body: `Deactivate ${warehouse.name}? Staff will still see historical records, but this warehouse will no longer be active for stock operations.`,
        confirmLabel: "Deactivate",
        onConfirm: () => changeWarehouseStatus(warehouse.id, action),
        title: "Deactivate warehouse"
      });
      return;
    }

    void changeWarehouseStatus(warehouse.id, action);
  }

  async function changeWarehouseStatus(id: string, action: "activate" | "deactivate") {
    setMessage(null);
    const warehouse = await statusMutation.mutateAsync({ action, id });
    setSelectedWarehouseId(warehouse.id);
    setMessage(action === "activate" ? "Warehouse activated." : "Warehouse deactivated.");
    await refreshWarehouses();
  }

  async function saveWarehouse(values: z.output<typeof warehouseFormSchema>) {
    setMessage(null);
    const payload = buildWarehousePayload(values);
    const savedWarehouse = editingWarehouseId
      ? await updateMutation.mutateAsync({ id: editingWarehouseId, payload })
      : await createMutation.mutateAsync(payload);
    const statusAction = getWarehouseStatusAction(savedWarehouse.status, values.status);
    const finalWarehouse = statusAction
      ? await statusMutation.mutateAsync({ action: statusAction, id: savedWarehouse.id })
      : savedWarehouse;

    setSelectedWarehouseId(finalWarehouse.id);
    setEditingWarehouseId(finalWarehouse.id);
    setFormValues(warehouseToFormValues(finalWarehouse));
    setMessage(editingWarehouseId ? "Warehouse updated." : "Warehouse created.");
    await refreshWarehouses();
  }

  function handleWarehouseSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = warehouseFormSchema.safeParse(formValues);

    if (!parsed.success) {
      setFieldErrors(getFieldErrors<WarehouseFormValues>(parsed.error));
      return;
    }

    setFieldErrors({});
    const statusAction = getWarehouseStatusAction(
      editingWarehouseId ? selectedWarehouse?.status : "ACTIVE",
      parsed.data.status
    );

    if (statusAction === "deactivate") {
      setConfirmation({
        body: `Save ${parsed.data.name} and deactivate it? Deactivated warehouses are kept for audit history but should not be used for new stock actions.`,
        confirmLabel: "Save and deactivate",
        onConfirm: () => saveWarehouse(parsed.data),
        title: "Confirm warehouse deactivation"
      });
      return;
    }

    void saveWarehouse(parsed.data);
  }

  async function handleAssignStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStaffError(null);

    if (!selectedWarehouseId) {
      return;
    }

    const parsed = warehouseStaffFormSchema.safeParse({ adminUserId: staffAdminUserId });

    if (!parsed.success) {
      setStaffError(parsed.error.issues[0]?.message ?? "Enter a valid admin user ID.");
      return;
    }

    await assignStaffMutation.mutateAsync({
      adminUserId: parsed.data.adminUserId,
      warehouseId: selectedWarehouseId
    });
    setStaffAdminUserId("");
    setMessage("Warehouse staff assigned.");
    await queryClient.invalidateQueries({
      queryKey: ["admin", "warehouses", selectedWarehouseId, "staff"]
    });
  }

  async function handleRemoveStaff(assignment: WarehouseStaffAssignment) {
    if (!selectedWarehouseId) {
      return;
    }

    await removeStaffMutation.mutateAsync({
      adminUserId: assignment.adminUserId,
      warehouseId: selectedWarehouseId
    });
    setMessage("Warehouse staff removed.");
    await queryClient.invalidateQueries({
      queryKey: ["admin", "warehouses", selectedWarehouseId, "staff"]
    });
  }

  return (
    <>
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Warehouse management</p>
            <h2>Warehouses and staff assignments</h2>
            <p className="panelSummary">
              Manage operational warehouse records, assigned staff access, and active status.
            </p>
          </div>
          <div className="actionRow">
            <button
              className="ghostButton iconTextButton"
              onClick={() => void warehousesQuery.refetch()}
              type="button"
            >
              <RefreshCw aria-hidden size={16} />
              <span>Refresh</span>
            </button>
            {canManage ? (
              <button className="primaryButton iconTextButton" onClick={startCreate} type="button">
                <Plus aria-hidden size={16} />
                <span>New warehouse</span>
              </button>
            ) : null}
          </div>
        </div>

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <article className="metric metric--primary">
            <span>Total warehouses</span>
            <strong>{warehousesQuery.data?.pagination.total ?? warehouses.length}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Visible</span>
            <strong>{warehouses.length}</strong>
          </article>
          <article className="metric metric--primary">
            <span>Active</span>
            <strong>{activeCount}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Inactive</span>
            <strong>{inactiveCount}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Find warehouses</h2>
          </div>
        </div>
        <WarehouseFilterForm
          filters={draftFilters}
          onChange={setDraftFilters}
          onReset={resetFilters}
          onSubmit={handleFilterSubmit}
        />
      </section>

      <div className="warehouseManagementGrid">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Warehouse list</p>
              <h2>Assigned warehouse scope</h2>
            </div>
          </div>

          {warehousesQuery.isLoading ? (
            <div className="loadingBlock">Loading warehouses...</div>
          ) : null}
          {warehousesQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
            </p>
          ) : null}
          {!warehousesQuery.isLoading && !warehousesQuery.isError && warehouses.length === 0 ? (
            <div className="emptyPanel">No warehouses match the selected filters.</div>
          ) : null}
          {warehouses.length > 0 ? (
            <div className="dataList" aria-label="Warehouses">
              {warehouses.map((warehouse) => (
                <button
                  className="listRow"
                  data-active={warehouse.id === selectedWarehouseId}
                  key={warehouse.id}
                  onClick={() => selectWarehouse(warehouse)}
                  type="button"
                >
                  <strong>{warehouse.name}</strong>
                  <span>{warehouse.code}</span>
                  <span>
                    {warehouse.city}, {warehouse.state}
                  </span>
                  <em>{formatWarehouseStatus(warehouse.status)}</em>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Warehouse detail</p>
              <h2>{selectedWarehouse?.name ?? "Select a warehouse"}</h2>
            </div>
            {selectedWarehouse ? (
              <div className="actionRow">
                {canManage ? (
                  <button
                    className="ghostButton iconTextButton"
                    onClick={() => startEdit(selectedWarehouse)}
                    type="button"
                  >
                    <Pencil aria-hidden size={16} />
                    <span>Edit</span>
                  </button>
                ) : null}
                {canManage && selectedWarehouse.status === "ACTIVE" ? (
                  <button
                    className="secondaryButton iconTextButton"
                    disabled={statusMutation.isPending}
                    onClick={() => requestStatusChange(selectedWarehouse, "deactivate")}
                    type="button"
                  >
                    <PowerOff aria-hidden size={16} />
                    <span>Deactivate</span>
                  </button>
                ) : null}
                {canManage && selectedWarehouse.status === "INACTIVE" ? (
                  <button
                    className="secondaryButton iconTextButton"
                    disabled={statusMutation.isPending}
                    onClick={() => requestStatusChange(selectedWarehouse, "activate")}
                    type="button"
                  >
                    <Power aria-hidden size={16} />
                    <span>Activate</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {warehouseDetailQuery.isLoading ? (
            <div className="loadingBlock">Loading warehouse detail...</div>
          ) : null}
          {selectedWarehouse ? (
            <WarehouseDetail warehouse={selectedWarehouse} />
          ) : (
            <div className="emptyPanel">Select a warehouse to view details.</div>
          )}
        </section>
      </div>

      <PermissionGate
        fallback={
          <section className="panel">
            <div className="emptyPanel">Warehouse management requires permission.</div>
          </section>
        }
        permission={ADMIN_PERMISSION.WarehouseManage}
      >
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">{editingWarehouseId ? "Edit warehouse" : "Create warehouse"}</p>
              <h2>{editingWarehouseId ? selectedWarehouse?.name ?? "Warehouse" : "New warehouse"}</h2>
            </div>
            {editingWarehouseId ? (
              <button className="ghostButton iconTextButton" onClick={startCreate} type="button">
                <X aria-hidden size={16} />
                <span>Clear</span>
              </button>
            ) : null}
          </div>
          <WarehouseForm
            errors={fieldErrors}
            isSaving={createMutation.isPending || updateMutation.isPending || statusMutation.isPending}
            onChange={setFormValues}
            onSubmit={handleWarehouseSubmit}
            values={formValues}
          />
        </section>
      </PermissionGate>

      <PermissionGate permission={ADMIN_PERMISSION.WarehouseStaffManage}>
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Warehouse staff</p>
              <h2>{selectedWarehouse?.name ?? "Select a warehouse"}</h2>
            </div>
          </div>

          {staffError ? (
            <p className="formError" role="alert">
              {staffError}
            </p>
          ) : null}
          <form className="inlineForm" onSubmit={handleAssignStaff}>
            <input
              onChange={(event) => setStaffAdminUserId(event.target.value)}
              placeholder="Admin user ID"
              value={staffAdminUserId}
            />
            <button
              className="primaryButton iconTextButton"
              disabled={!selectedWarehouseId || assignStaffMutation.isPending}
              type="submit"
            >
              <UserPlus aria-hidden size={16} />
              <span>{assignStaffMutation.isPending ? "Assigning..." : "Assign staff"}</span>
            </button>
          </form>

          {staffQuery.isLoading ? (
            <div className="loadingBlock">Loading staff assignments...</div>
          ) : null}
          {staffQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(staffQuery.error) ?? "Unable to load staff assignments."}
            </p>
          ) : null}
          {(staffQuery.data?.length ?? 0) === 0 && !staffQuery.isLoading ? (
            <div className="emptyPanel smallEmpty">No staff assigned to this warehouse.</div>
          ) : null}
          {(staffQuery.data?.length ?? 0) > 0 ? (
            <div className="queueTable">
              {staffQuery.data?.map((assignment) => (
                <div className="queueRow warehouseStaffRow" key={assignment.id}>
                  <div>
                    <strong>
                      {assignment.firstName} {assignment.lastName ?? ""}
                    </strong>
                    <span>{assignment.email}</span>
                  </div>
                  <span>{assignment.adminUserId}</span>
                  <button
                    className="ghostButton"
                    disabled={removeStaffMutation.isPending}
                    onClick={() => void handleRemoveStaff(assignment)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </PermissionGate>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isMutating}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function WarehouseFilterForm({
  filters,
  onChange,
  onReset,
  onSubmit
}: {
  filters: WarehouseFilters;
  onChange: (filters: WarehouseFilters) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="warehouseFilters" onSubmit={onSubmit}>
      <label>
        Search
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <input
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Name, code, city"
            value={filters.search}
          />
        </span>
      </label>
      <label>
        State
        <input
          onChange={(event) => onChange({ ...filters, state: event.target.value })}
          placeholder="Maharashtra"
          value={filters.state}
        />
      </label>
      <label>
        Status
        <select
          onChange={(event) =>
            onChange({ ...filters, status: event.target.value as "" | WarehouseStatus })
          }
          value={filters.status}
        >
          <option value="">Any</option>
          {WAREHOUSE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatWarehouseStatus(status)}
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

function WarehouseDetail({ warehouse }: { warehouse: AdminWarehouse }) {
  return (
    <div className="detailGrid">
      <DetailItem label="Code" value={warehouse.code} />
      <DetailItem
        label="Status"
        value={<span className={`statusBadge statusBadge--${warehouse.status.toLowerCase()}`}>{formatWarehouseStatus(warehouse.status)}</span>}
      />
      <DetailItem label="Address" value={warehouse.address} wide />
      <DetailItem label="City" value={warehouse.city} />
      <DetailItem label="State" value={warehouse.state} />
      <DetailItem label="Pincode" value={warehouse.pincode} />
      <DetailItem label="Latitude" value={warehouse.latitude ?? "-"} />
      <DetailItem label="Longitude" value={warehouse.longitude ?? "-"} />
      <DetailItem label="Contact person" value={warehouse.contactPerson} />
      <DetailItem label="Contact number" value={warehouse.contactNumber} />
    </div>
  );
}

function DetailItem({
  label,
  value,
  wide = false
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="detailItem" data-wide={wide}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WarehouseForm({
  errors,
  isSaving,
  onChange,
  onSubmit,
  values
}: {
  errors: WarehouseFieldErrors;
  isSaving: boolean;
  onChange: (values: WarehouseFormValues) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  values: WarehouseFormValues;
}) {
  function updateValue<Key extends keyof WarehouseFormValues>(
    key: Key,
    value: WarehouseFormValues[Key]
  ) {
    onChange({
      ...values,
      [key]: value
    });
  }

  return (
    <form className="formStack" onSubmit={onSubmit}>
      <div className="formGrid">
        <TextField error={errors.name} label="Warehouse name" onChange={(value) => updateValue("name", value)} value={values.name} />
        <TextField error={errors.code} label="Warehouse code" onChange={(value) => updateValue("code", value.toUpperCase())} value={values.code} />
        <TextField error={errors.address} label="Address" onChange={(value) => updateValue("address", value)} value={values.address} />
        <TextField error={errors.city} label="City" onChange={(value) => updateValue("city", value)} value={values.city} />
        <TextField error={errors.state} label="State" onChange={(value) => updateValue("state", value)} value={values.state} />
        <TextField error={errors.pincode} inputMode="numeric" label="Pincode" onChange={(value) => updateValue("pincode", value)} value={values.pincode} />
        <TextField error={errors.latitude} inputMode="decimal" label="Latitude" onChange={(value) => updateValue("latitude", value)} required={false} value={values.latitude} />
        <TextField error={errors.longitude} inputMode="decimal" label="Longitude" onChange={(value) => updateValue("longitude", value)} required={false} value={values.longitude} />
        <TextField error={errors.contactPerson} label="Contact person" onChange={(value) => updateValue("contactPerson", value)} value={values.contactPerson} />
        <TextField error={errors.contactNumber} label="Contact number" onChange={(value) => updateValue("contactNumber", value)} value={values.contactNumber} />
        <label>
          Status
          <select
            onChange={(event) => updateValue("status", event.target.value as WarehouseStatus)}
            value={values.status}
          >
            {WAREHOUSE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatWarehouseStatus(status)}
              </option>
            ))}
          </select>
          {errors.status ? <span className="fieldError">{errors.status}</span> : null}
        </label>
      </div>
      <div className="actionRow">
        <button className="primaryButton iconTextButton" disabled={isSaving} type="submit">
          <CheckCircle2 aria-hidden size={16} />
          <span>{isSaving ? "Saving..." : "Save warehouse"}</span>
        </button>
      </div>
    </form>
  );
}

function TextField({
  error,
  inputMode,
  label,
  onChange,
  required = true,
  value
}: {
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label>
      {label}
      <input
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function getFieldErrors<TFields extends Record<string, unknown>>(
  error: z.ZodError
) {
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
