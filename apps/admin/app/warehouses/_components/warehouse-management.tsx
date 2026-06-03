"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ConfirmationDialog, type ConfirmationState } from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AdminShell } from "../../admin-shell";
import {
  PermissionGate,
  ProtectedRoute,
  useAdminSession
} from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import {
  WAREHOUSE_STATUSES,
  WAREHOUSE_LIST_PATH,
  buildWarehouseCreatePath,
  buildWarehouseEditPath,
  buildWarehousePayload,
  buildWarehouseQuery,
  createEmptyWarehouseFilters,
  createEmptyWarehouseFormValues,
  formatWarehouseStatus,
  getWarehouseAnalytics,
  getWarehouseFilterContent,
  getWarehouseStatusAction,
  shouldShowWarehouseFilters,
  warehouseFormSchema,
  warehouseStaffFormSchema,
  warehouseToFormValues,
  type AdminWarehouse,
  type WarehouseFilters,
  type WarehouseFormValues,
  type WarehouseListResponse,
  type WarehouseStaffAssignment,
  type WarehouseStatus
} from "../../../lib/warehouse-management";

type WarehouseFieldErrors = Partial<Record<keyof WarehouseFormValues, string>>;
export type WarehouseView = "analytics" | "create" | "list" | "staff";
const ALL_WAREHOUSE_STATUSES_VALUE = "__all_warehouse_statuses__";

export function WarehouseManagementPage({
  initialEditWarehouseId = null,
  returnToPath = null,
  view
}: {
  initialEditWarehouseId?: string | null;
  returnToPath?: string | null;
  view: WarehouseView;
}) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.WarehouseRead}>
        <WarehousesContent
          initialEditWarehouseId={initialEditWarehouseId}
          returnToPath={returnToPath}
          view={view}
        />
      </ProtectedRoute>
    </AdminShell>
  );
}

function WarehousesContent({
  initialEditWarehouseId,
  returnToPath,
  view
}: {
  initialEditWarehouseId: string | null;
  returnToPath: string | null;
  view: WarehouseView;
}) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [draftFilters, setDraftFilters] = useState<WarehouseFilters>(
    createEmptyWarehouseFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<WarehouseFilters>(
    createEmptyWarehouseFilters()
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    initialEditWarehouseId
  );
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(
    initialEditWarehouseId
  );
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
    enabled: Boolean(selectedWarehouseId && view === "create"),
    queryFn: () => api.request<AdminWarehouse>(`/admin/warehouses/${selectedWarehouseId ?? ""}`),
    queryKey: ["admin", "warehouses", selectedWarehouseId]
  });

  const staffQuery = useQuery({
    enabled: Boolean(view === "staff" && selectedWarehouseId && canManageStaff),
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
  const analytics = getWarehouseAnalytics(warehouses);
  const totalCount = warehousesQuery.data?.pagination.total ?? analytics.visible;
  const selectedWarehouse =
    warehouseDetailQuery.data ??
    warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ??
    null;
  const showWarehouseFilters = shouldShowWarehouseFilters(view);
  const warehouseFilterContent = getWarehouseFilterContent(view);
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
    if (view === "create" && initialEditWarehouseId) {
      return;
    }

    if (view !== "staff") {
      return;
    }

    if (warehouses.length === 0) {
      setSelectedWarehouseId(null);
      return;
    }

    if (!selectedWarehouseId || !warehouses.some((warehouse) => warehouse.id === selectedWarehouseId)) {
      setSelectedWarehouseId(warehouses[0]?.id ?? null);
    }
  }, [initialEditWarehouseId, selectedWarehouseId, view, warehouses]);

  useEffect(() => {
    if (view !== "create") {
      return;
    }

    setSelectedWarehouseId(initialEditWarehouseId);
    setEditingWarehouseId(initialEditWarehouseId);
    setFieldErrors({});
    setMessage(null);

    if (!initialEditWarehouseId) {
      setFormValues(createEmptyWarehouseFormValues());
    }
  }, [initialEditWarehouseId, view]);

  useEffect(() => {
    if (
      !editingWarehouseId ||
      !selectedWarehouse ||
      selectedWarehouse.id !== editingWarehouseId
    ) {
      return;
    }

    setFormValues(warehouseToFormValues(selectedWarehouse));
    setFieldErrors({});
  }, [editingWarehouseId, selectedWarehouse]);

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

    if (view === "create") {
      router.push(buildWarehouseCreatePath(WAREHOUSE_LIST_PATH));
    }
  }

  function startEdit(warehouse: AdminWarehouse) {
    router.push(buildWarehouseEditPath(warehouse.id));
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
    const wasEditing = Boolean(editingWarehouseId);
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

    const redirectAfterSavePath = wasEditing ? WAREHOUSE_LIST_PATH : returnToPath;

    if (view === "create" && redirectAfterSavePath) {
      router.push(redirectAfterSavePath);
    }
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
      {view === "analytics" ? (
        <Card className="panel">
          <PageHeader
            actions={
              <>
                <Button
                  className="iconTextButton"
                  onClick={() => void warehousesQuery.refetch()}
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden size={16} />
                  <span>Refresh</span>
                </Button>
                {canManage ? (
                  <Button asChild className="buttonLink iconTextButton">
                    <Link href={buildWarehouseCreatePath(WAREHOUSE_LIST_PATH)}>
                      <Plus aria-hidden size={16} />
                      <span>New warehouse</span>
                    </Link>
                  </Button>
                ) : null}
              </>
            }
            eyebrow="Warehouse analytics"
            summary="Track warehouse coverage, status mix, and filtered operating footprint."
            title="Warehouse overview"
          />

          {message ? <p className="formSuccess">{message}</p> : null}
          {mutationError ? (
            <p className="formError" role="alert">
              {mutationError}
            </p>
          ) : null}
        </Card>
      ) : null}

      {showWarehouseFilters ? (
        <Card className="panel">
          <WarehouseFilterForm
            content={warehouseFilterContent}
            filters={draftFilters}
            onChange={setDraftFilters}
            onReset={resetFilters}
            onSubmit={handleFilterSubmit}
          />
        </Card>
      ) : null}

      {view === "analytics" ? (
        <WarehouseAnalytics
          analytics={analytics}
          totalCount={totalCount}
          warehouses={warehouses}
        />
      ) : null}

      {view === "list" ? (
        <Card className="panel">
          <PageHeader
            actions={
              canManage ? (
                <Button asChild className="buttonLink iconTextButton">
                  <Link href={buildWarehouseCreatePath(WAREHOUSE_LIST_PATH)}>
                    <Plus aria-hidden size={16} />
                    <span>Create warehouse</span>
                  </Link>
                </Button>
              ) : null
            }
            eyebrow="Warehouse list"
            title="Filtered warehouse table"
          />
          {message ? <p className="formSuccess">{message}</p> : null}
          {mutationError ? (
            <p className="formError" role="alert">
              {mutationError}
            </p>
          ) : null}

          {warehousesQuery.isLoading ? (
            <LoadingState label="Loading warehouses..." />
          ) : null}
          {warehousesQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
            </p>
          ) : null}
          {!warehousesQuery.isLoading && !warehousesQuery.isError && warehouses.length === 0 ? (
            <EmptyState
              body="No warehouses match the selected filters."
              title="No warehouses found"
            />
          ) : null}
          {warehouses.length > 0 ? (
            <WarehouseTable
              canManage={canManage}
              isMutating={statusMutation.isPending}
              onActivate={(warehouse) => void requestStatusChange(warehouse, "activate")}
              onDeactivate={(warehouse) => requestStatusChange(warehouse, "deactivate")}
              onEdit={startEdit}
              selectedWarehouseId={null}
              warehouses={warehouses}
            />
          ) : null}
        </Card>
      ) : null}

      {view === "create" ? (
        <>
          <PermissionGate
            fallback={
              <Card className="panel">
              <div className="emptyPanel">Warehouse management requires permission.</div>
              </Card>
            }
            permission={ADMIN_PERMISSION.WarehouseManage}
          >
            <Card className="panel">
              <PageHeader
                actions={
                  editingWarehouseId ? (
                    <Button className="iconTextButton" onClick={startCreate} type="button" variant="outline">
                      <X aria-hidden size={16} />
                      <span>Clear</span>
                    </Button>
                  ) : null
                }
                eyebrow={editingWarehouseId ? "Edit warehouse" : "Create warehouse"}
                title={editingWarehouseId ? selectedWarehouse?.name ?? "Warehouse" : "New warehouse"}
              />
              {message ? <p className="formSuccess">{message}</p> : null}
              {mutationError ? (
                <p className="formError" role="alert">
                  {mutationError}
                </p>
              ) : null}
              {editingWarehouseId && warehouseDetailQuery.isLoading ? (
                <LoadingState label="Loading warehouse detail..." />
              ) : null}
              {editingWarehouseId && warehouseDetailQuery.isError ? (
                <p className="formError" role="alert">
                  {getErrorMessage(warehouseDetailQuery.error) ?? "Unable to load warehouse detail."}
                </p>
              ) : null}
              {!editingWarehouseId ||
              (!warehouseDetailQuery.isLoading && !warehouseDetailQuery.isError) ? (
                <WarehouseForm
                  errors={fieldErrors}
                  isSaving={createMutation.isPending || updateMutation.isPending || statusMutation.isPending}
                  onChange={setFormValues}
                  onSubmit={handleWarehouseSubmit}
                  values={formValues}
                />
              ) : null}
            </Card>
          </PermissionGate>
        </>
      ) : null}

      {view === "staff" ? (
        <PermissionGate
          fallback={
            <EmptyState
              body="Your admin role cannot manage warehouse staff."
              title="Staff management unavailable"
            />
          }
          permission={ADMIN_PERMISSION.WarehouseStaffManage}
        >
          <Card className="panel">
            <PageHeader
              eyebrow="Warehouse staff"
              title={selectedWarehouse?.name ?? "Select a warehouse"}
            />
            {message ? <p className="formSuccess">{message}</p> : null}
            {mutationError ? (
              <p className="formError" role="alert">
                {mutationError}
              </p>
            ) : null}

            {warehousesQuery.isLoading ? (
              <LoadingState label="Loading warehouses..." />
            ) : null}
            {warehousesQuery.isError ? (
              <p className="formError" role="alert">
                {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
              </p>
            ) : null}
            {!warehousesQuery.isLoading && !warehousesQuery.isError && warehouses.length === 0 ? (
              <EmptyState
                body="No warehouses match the selected filters."
                title="No warehouses found"
              />
            ) : null}
            {warehouses.length > 0 ? (
              <div className="warehouseStaffPicker">
                <Label>
                  Warehouse
                  <Select
                    onValueChange={(value) => {
                      const warehouse = warehouses.find((item) => item.id === value);
                      if (warehouse) {
                        selectWarehouse(warehouse);
                      }
                    }}
                    value={selectedWarehouseId ?? ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({warehouse.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                {selectedWarehouse ? (
                  <p>
                    {selectedWarehouse.city}, {selectedWarehouse.state} -{" "}
                    {formatWarehouseStatus(selectedWarehouse.status)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {selectedWarehouse ? (
              <>
              {staffError ? (
                <p className="formError" role="alert">
                  {staffError}
                </p>
              ) : null}
              <form className="inlineForm" onSubmit={handleAssignStaff}>
                <Input
                  onChange={(event) => setStaffAdminUserId(event.target.value)}
                  placeholder="Admin user ID"
                  value={staffAdminUserId}
                />
                <Button
                  className="iconTextButton"
                  disabled={!selectedWarehouseId || assignStaffMutation.isPending}
                  type="submit"
                >
                  <UserPlus aria-hidden size={16} />
                  <span>{assignStaffMutation.isPending ? "Assigning..." : "Assign staff"}</span>
                </Button>
              </form>

              {staffQuery.isLoading ? (
                <LoadingState label="Loading staff assignments..." />
              ) : null}
              {staffQuery.isError ? (
                <p className="formError" role="alert">
                  {getErrorMessage(staffQuery.error) ?? "Unable to load staff assignments."}
                </p>
              ) : null}
              {(staffQuery.data?.length ?? 0) === 0 && !staffQuery.isLoading ? (
                <EmptyState
                  body="No staff assigned to this warehouse."
                  title="No staff assigned"
                />
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
                      <Button
                        disabled={removeStaffMutation.isPending}
                        onClick={() => void handleRemoveStaff(assignment)}
                        type="button"
                        variant="outline"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              </>
            ) : null}
          </Card>
        </PermissionGate>
      ) : null}

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isMutating}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function WarehouseAnalytics({
  analytics,
  totalCount,
  warehouses
}: {
  analytics: ReturnType<typeof getWarehouseAnalytics>;
  totalCount: number;
  warehouses: AdminWarehouse[];
}) {
  const stateRows = Array.from(
    warehouses.reduce((states, warehouse) => {
      const current = states.get(warehouse.state) ?? {
        active: 0,
        inactive: 0,
        state: warehouse.state,
        total: 0
      };

      current.total += 1;
      if (warehouse.status === "ACTIVE") {
        current.active += 1;
      } else {
        current.inactive += 1;
      }
      states.set(warehouse.state, current);
      return states;
    }, new Map<string, { active: number; inactive: number; state: string; total: number }>())
  )
    .map(([, value]) => value)
    .sort((left, right) => right.total - left.total || left.state.localeCompare(right.state));

  return (
    <>
      <Card className="panel">
        <div className="metricGrid resourceMetrics">
          <MetricCard label="Total warehouses" tone="primary" value={totalCount} />
          <MetricCard label="Visible after filter" value={analytics.visible} />
          <MetricCard label="Active" tone="primary" value={analytics.active} />
          <MetricCard label="Inactive" tone="warning" value={analytics.inactive} />
        </div>
      </Card>

      <Card className="panel">
        <PageHeader
          actions={<span>{analytics.states} states</span>}
          eyebrow="Coverage"
          title="Warehouse footprint by state"
        />
        {stateRows.length > 0 ? (
          <div className="resourceTable warehouseAnalyticsTable">
            <Table>
              <TableHeader>
                <TableRow className="warehouseAnalyticsTableRow">
                  <TableHead>State</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Inactive</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateRows.map((row) => (
                  <TableRow className="warehouseAnalyticsTableRow" key={row.state}>
                    <TableCell>
                  <strong>{row.state}</strong>
                    </TableCell>
                    <TableCell>{row.total}</TableCell>
                    <TableCell>{row.active}</TableCell>
                    <TableCell>{row.inactive}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            body="No warehouses match the selected filters."
            title="No warehouses found"
          />
        )}
      </Card>
    </>
  );
}

function WarehouseTable({
  canManage,
  isMutating,
  onActivate,
  onDeactivate,
  onEdit,
  selectedWarehouseId,
  warehouses
}: {
  canManage: boolean;
  isMutating: boolean;
  onActivate: (warehouse: AdminWarehouse) => void;
  onDeactivate: (warehouse: AdminWarehouse) => void;
  onEdit: (warehouse: AdminWarehouse) => void;
  selectedWarehouseId: string | null;
  warehouses: AdminWarehouse[];
}) {
  return (
    <div className="resourceTable warehouseTable">
      <Table>
        <TableHeader>
          <TableRow className="warehouseTableRow">
            <TableHead>Warehouse</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {warehouses.map((warehouse) => (
            <TableRow
              className="warehouseTableRow"
              data-active={selectedWarehouseId === warehouse.id}
              key={warehouse.id}
            >
              <TableCell>
                <strong>{warehouse.name}</strong>
                <em>{warehouse.code}</em>
              </TableCell>
              <TableCell>
                {warehouse.city}, {warehouse.state}
                <em>{warehouse.pincode}</em>
              </TableCell>
              <TableCell>
                {warehouse.contactPerson}
                <em>{warehouse.contactNumber}</em>
              </TableCell>
              <TableCell>
                <StatusBadge status={warehouse.status} />
              </TableCell>
              <TableCell>
                <span className="tableActions">
            <Button
              className="iconTextButton"
              disabled={!canManage}
              onClick={() => onEdit(warehouse)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Pencil aria-hidden size={16} />
              <span>Edit</span>
            </Button>
            {warehouse.status === "ACTIVE" ? (
              <Button
                className="iconTextButton"
                disabled={!canManage || isMutating}
                onClick={() => onDeactivate(warehouse)}
                size="sm"
                type="button"
                variant="secondary"
              >
                <PowerOff aria-hidden size={16} />
                <span>Deactivate</span>
              </Button>
            ) : (
              <Button
                className="iconTextButton"
                disabled={!canManage || isMutating}
                onClick={() => onActivate(warehouse)}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Power aria-hidden size={16} />
                <span>Activate</span>
              </Button>
            )}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WarehouseFilterForm({
  content,
  filters,
  onChange,
  onReset,
  onSubmit
}: {
  content: ReturnType<typeof getWarehouseFilterContent>;
  filters: WarehouseFilters;
  onChange: (filters: WarehouseFilters) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="warehouseFilters" onSubmit={onSubmit}>
      <Label>
        Search
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <Input
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder={content.searchPlaceholder}
            value={filters.search}
          />
        </span>
      </Label>
      <Label>
        State
        <Input
          onChange={(event) => onChange({ ...filters, state: event.target.value })}
          placeholder="Maharashtra"
          value={filters.state}
        />
      </Label>
      <Label>
        Status
        <Select
          onValueChange={(value) =>
            onChange({
              ...filters,
              status:
                value === ALL_WAREHOUSE_STATUSES_VALUE
                  ? ""
                  : (value as WarehouseStatus)
            })
          }
          value={filters.status || ALL_WAREHOUSE_STATUSES_VALUE}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_WAREHOUSE_STATUSES_VALUE}>Any</SelectItem>
            {WAREHOUSE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {formatWarehouseStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <div className="productFilterActions">
        <Button className="iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>{content.submitLabel}</span>
        </Button>
        <Button onClick={onReset} type="button" variant="outline">
          Reset
        </Button>
      </div>
    </form>
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
        <Label>
          Status
          <Select
            onValueChange={(value) => updateValue("status", value as WarehouseStatus)}
            value={values.status}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {WAREHOUSE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatWarehouseStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status ? <span className="fieldError">{errors.status}</span> : null}
        </Label>
      </div>
      <div className="actionRow">
        <Button className="iconTextButton" disabled={isSaving} type="submit">
          <CheckCircle2 aria-hidden size={16} />
          <span>{isSaving ? "Saving..." : "Save warehouse"}</span>
        </Button>
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
    <Label>
      {label}
      <Input
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
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
