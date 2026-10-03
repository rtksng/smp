"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserMinus,
  UserPlus,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ConfirmationDialog, type ConfirmationState } from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterDrawer } from "@/components/admin/filter-drawer";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
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
import { useClientPagination } from "@/lib/use-client-pagination";
import { AdminShell } from "../../admin-shell";
import {
  PermissionGate,
  ProtectedRoute,
  useAdminSession
} from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import {
  WAREHOUSE_STATUSES,
  WAREHOUSES_PATH,
  buildWarehouseCreatePath,
  buildWarehouseDetailPath,
  buildWarehouseEditPath,
  buildWarehousePayload,
  loadWarehouseResults,
  createEmptyWarehouseFilters,
  createEmptyWarehouseFormValues,
  formatWarehouseStaffCandidate,
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
  type WarehouseStaffCandidate,
  type WarehouseStatus
} from "../../../lib/warehouse-management";
import "../warehouse-responsive.css";

type WarehouseFieldErrors = Partial<Record<keyof WarehouseFormValues, string>>;
export type WarehouseView = "create" | "list" | "staff";
const ALL_WAREHOUSE_STATUSES_VALUE = "__all_warehouse_statuses__";

export function WarehouseManagementPage({
  initialEditWarehouseId = null,
  initialFilters = null,
  returnToPath = null,
  view
}: {
  initialEditWarehouseId?: string | null;
  initialFilters?: WarehouseFilters | null;
  returnToPath?: string | null;
  view: WarehouseView;
}) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.WarehouseRead}>
        <WarehousesContent
          initialEditWarehouseId={initialEditWarehouseId}
          initialFilters={initialFilters}
          returnToPath={returnToPath}
          view={view}
        />
      </ProtectedRoute>
    </AdminShell>
  );
}

function WarehousesContent({
  initialEditWarehouseId,
  initialFilters,
  returnToPath,
  view
}: {
  initialEditWarehouseId: string | null;
  initialFilters: WarehouseFilters | null;
  returnToPath: string | null;
  view: WarehouseView;
}) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const urlFilters = useMemo(
    () => initialFilters ?? createEmptyWarehouseFilters(),
    [initialFilters]
  );
  const [draftFilters, setDraftFilters] = useState<WarehouseFilters>(
    urlFilters
  );
  const [appliedFilters, setAppliedFilters] = useState<WarehouseFilters>(
    urlFilters
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const initializedFormId = useRef<string | null>(null);
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
    enabled: view !== "create",
    queryFn: ({ signal }) => loadWarehouseResults(
      (query) => api.request<WarehouseListResponse>("/admin/warehouses", { query, signal }),
      appliedFilters
    ),
    queryKey: ["admin", "warehouses", appliedFilters, view]
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

  // Nested under the staff key so assigning or removing staff also refreshes this list.
  const staffCandidatesQuery = useQuery({
    enabled: Boolean(view === "staff" && selectedWarehouseId && canManageStaff),
    queryFn: () =>
      api.request<WarehouseStaffCandidate[]>(
        `/admin/warehouses/${selectedWarehouseId ?? ""}/staff/candidates`
      ),
    queryKey: ["admin", "warehouses", selectedWarehouseId, "staff", "candidates"]
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
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.request<void>(`/admin/warehouses/${id}`, { method: "DELETE" })
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
  const staffCandidates = staffCandidatesQuery.data ?? [];
  const staffCandidatePlaceholder = staffCandidatesQuery.isLoading
    ? "Loading admin users..."
    : staffCandidates.length > 0
      ? "Select admin user"
      : "No admin users to assign";
  const showWarehouseFilters = shouldShowWarehouseFilters(view);
  const warehouseFilterContent = getWarehouseFilterContent(view);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    statusMutation.isPending ||
    assignStaffMutation.isPending ||
    removeStaffMutation.isPending || deleteMutation.isPending;

  async function runAction(action: () => Promise<void>) {
    setMutationError(null);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMutationError(getErrorMessage(error) ?? "Action failed. Please try again.");
    }
  }
  const warehouseFilterAction = showWarehouseFilters ? (
    <Button
      aria-label="Add filter"
      className="iconTextButton"
      onClick={() => setIsFilterDrawerOpen(true)}
      type="button"
      variant="outline"
    >
      <SlidersHorizontal aria-hidden size={16} />
      <span className="warehouseActionLabelFull">Add filter</span>
      <span className="warehouseActionLabelCompact">Filter</span>
    </Button>
  ) : null;
  const warehouseBackPath = returnToPath ?? WAREHOUSES_PATH;

  useEffect(() => {
    setDraftFilters(urlFilters);
    setAppliedFilters(urlFilters);
  }, [urlFilters]);

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
    initializedFormId.current = null;
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
      selectedWarehouse.id !== editingWarehouseId ||
      initializedFormId.current === editingWarehouseId
    ) {
      return;
    }

    setFormValues(warehouseToFormValues(selectedWarehouse));
    initializedFormId.current = editingWarehouseId;
    setFieldErrors({});
  }, [editingWarehouseId, selectedWarehouse]);

  async function refreshWarehouses() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
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
    setMutationError(null);
    setStaffError(null);
    setStaffAdminUserId("");
  }

  function startCreate() {
    setEditingWarehouseId(null);
    setFormValues(createEmptyWarehouseFormValues());
    setFieldErrors({});
    setMessage(null);

    if (view === "create") {
      router.push(buildWarehouseCreatePath(WAREHOUSES_PATH));
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

    void runAction(() => changeWarehouseStatus(warehouse.id, action));
  }

  async function changeWarehouseStatus(id: string, action: "activate" | "deactivate") {
    setMessage(null);
    setMutationError(null);
    const warehouse = await statusMutation.mutateAsync({ action, id });
    setSelectedWarehouseId(warehouse.id);
    setMessage(action === "activate" ? "Warehouse activated." : "Warehouse deactivated.");
    await refreshWarehouses();
  }

  async function saveWarehouse(values: z.output<typeof warehouseFormSchema>) {
    setMessage(null);
    setMutationError(null);
    const wasEditing = Boolean(editingWarehouseId);
    const payload = buildWarehousePayload(values);
    const savedWarehouse = editingWarehouseId
      ? await updateMutation.mutateAsync({ id: editingWarehouseId, payload })
      : await createMutation.mutateAsync(payload);
    const finalWarehouse = savedWarehouse;

    setSelectedWarehouseId(finalWarehouse.id);
    setEditingWarehouseId(finalWarehouse.id);
    setFormValues(warehouseToFormValues(finalWarehouse));
    setMessage(editingWarehouseId ? "Warehouse updated." : "Warehouse created.");
    await refreshWarehouses();

    const redirectAfterSavePath = wasEditing ? returnToPath ?? WAREHOUSES_PATH : returnToPath;

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

    void runAction(() => saveWarehouse(parsed.data));
  }

  async function handleAssignStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStaffError(null);

    if (!selectedWarehouseId) {
      return;
    }

    const parsed = warehouseStaffFormSchema.safeParse({ adminUserId: staffAdminUserId });

    if (!parsed.success) {
      setStaffError(parsed.error.issues[0]?.message ?? "Select an admin user to assign.");
      return;
    }

    await runAction(async () => {
      await assignStaffMutation.mutateAsync({
        adminUserId: parsed.data.adminUserId,
        warehouseId: selectedWarehouseId
      });
      setStaffAdminUserId("");
      setMessage("Warehouse staff assigned.");
      await queryClient.invalidateQueries({
        queryKey: ["admin", "warehouses", selectedWarehouseId, "staff"]
      });
    });
  }

  async function handleRemoveStaff(assignment: WarehouseStaffAssignment) {
    if (!selectedWarehouseId) {
      return;
    }

    await runAction(async () => {
      await removeStaffMutation.mutateAsync({
        adminUserId: assignment.adminUserId,
        warehouseId: selectedWarehouseId
      });
      setMessage("Warehouse staff removed.");
      await queryClient.invalidateQueries({
        queryKey: ["admin", "warehouses", selectedWarehouseId, "staff"]
      });
    });
  }

  function requestDelete(warehouse: AdminWarehouse) {
    setConfirmation({
      title: "Delete warehouse",
      body: `Delete ${warehouse.name}? Warehouses with inventory or linked operations cannot be deleted.`,
      confirmLabel: "Delete warehouse",
      onConfirm: async () => {
        setMutationError(null);
        setMessage(null);
        await deleteMutation.mutateAsync(warehouse.id);
        setMessage("Warehouse deleted.");
        await refreshWarehouses();
      }
    });
  }

  return (
    <div className="warehouseModule" data-warehouse-view={view}>
      {view === "list" ? (
        <Card className="panel warehouseOverviewPanel">
          <PageHeader
            className="warehousePageHeader"
            level={2}
            actions={
              <div className="actionRow warehouseHeaderActions warehouseOverviewHeaderActions">
                {warehouseFilterAction}
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
                    <Link
                      aria-label="New warehouse"
                      href={buildWarehouseCreatePath(WAREHOUSES_PATH)}
                    >
                      <Plus aria-hidden size={16} />
                      <span className="warehouseActionLabelFull">New warehouse</span>
                      <span className="warehouseActionLabelCompact">New</span>
                    </Link>
                  </Button>
                ) : null}
              </div>
            }
            eyebrow="Warehouses"
            summary="Filter warehouses, track their status mix, and manage each record."
            title="Warehouse overview"
          />

          <div className="metricGrid resourceMetrics warehouseMetricGrid">
            <MetricCard label="Total warehouses" tone="primary" value={totalCount} />
            <MetricCard label="Visible after filter" value={analytics.visible} />
            <MetricCard label="Active" tone="primary" value={analytics.active} />
            <MetricCard label="Inactive" tone="warning" value={analytics.inactive} />
          </div>
        </Card>
      ) : null}

      {showWarehouseFilters ? (
        <FilterDrawer
          applyLabel={warehouseFilterContent.submitLabel}
          isOpen={isFilterDrawerOpen}
          isSubmitting={warehousesQuery.isFetching}
          onApply={handleFilterSubmit}
          onOpenChange={setIsFilterDrawerOpen}
          onReset={resetFilters}
          summary="Filter warehouses by name, code, city, state, or status."
          title="Warehouse filters"
        >
          <WarehouseFilterFields
            content={warehouseFilterContent}
            filters={draftFilters}
            onChange={setDraftFilters}
          />
        </FilterDrawer>
      ) : null}

      {view === "list" ? (
        <Card className="panel warehouseListPanel">
          <PageHeader
            className="warehousePageHeader"
            level={2}
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
              isMutating={isMutating}
              onActivate={(warehouse) => void requestStatusChange(warehouse, "activate")}
              onDeactivate={(warehouse) => requestStatusChange(warehouse, "deactivate")}
              onEdit={startEdit}
              onDelete={requestDelete}
              scope={JSON.stringify(appliedFilters)}
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
            <Card className="panel warehouseCreatePanel">
              <PageHeader
                backHref={warehouseBackPath}
                backLabel="Back to warehouses"
                className="warehousePageHeader warehouseCreateHeader"
                level={2}
                actions={
                  editingWarehouseId ? (
                    <div className="actionRow warehouseHeaderActions warehouseCreateHeaderActions">
                      <Button className="iconTextButton" onClick={startCreate} type="button" variant="outline">
                        <X aria-hidden size={16} />
                        <span>Clear</span>
                      </Button>
                    </div>
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
          <Card className="panel warehouseStaffPanel">
            <PageHeader
              className="warehousePageHeader warehouseStaffHeader"
              level={2}
              actions={
                <div className="actionRow warehouseHeaderActions warehouseStaffHeaderActions">
                  {warehouseFilterAction}
                </div>
              }
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
                    disabled={isMutating}
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
              {staffCandidatesQuery.isError ? (
                <p className="formError" role="alert">
                  {getErrorMessage(staffCandidatesQuery.error) ?? "Unable to load admin users."}
                </p>
              ) : null}
              <form className="inlineForm warehouseStaffAssignForm" onSubmit={handleAssignStaff}>
                <Select
                  aria-label="Admin user"
                  disabled={isMutating || staffCandidates.length === 0}
                  onValueChange={setStaffAdminUserId}
                  value={staffAdminUserId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={staffCandidatePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {staffCandidates.map((candidate) => (
                      <SelectItem key={candidate.adminUserId} value={candidate.adminUserId}>
                        {formatWarehouseStaffCandidate(candidate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="iconTextButton"
                  disabled={!selectedWarehouseId || isMutating}
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
              {(staffQuery.data?.length ?? 0) === 0 && !staffQuery.isLoading && !staffQuery.isError ? (
                <EmptyState
                  body="No staff assigned to this warehouse."
                  title="No staff assigned"
                />
              ) : null}
              {(staffQuery.data?.length ?? 0) > 0 ? (
                <WarehouseStaffTable
                  assignments={staffQuery.data ?? []}
                  isMutating={isMutating}
                  onRemove={(assignment) => void handleRemoveStaff(assignment)}
                  scope={selectedWarehouse.id}
                />
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
    </div>
  );
}

function WarehouseTable({
  canManage,
  isMutating,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
  scope,
  warehouses
}: {
  canManage: boolean;
  isMutating: boolean;
  onActivate: (warehouse: AdminWarehouse) => void;
  onDeactivate: (warehouse: AdminWarehouse) => void;
  onEdit: (warehouse: AdminWarehouse) => void;
  onDelete: (warehouse: AdminWarehouse) => void;
  scope: string;
  warehouses: AdminWarehouse[];
}) {
  const warehousePages = useClientPagination(warehouses, scope);

  return (
    <>
      <div className="resourceTable warehouseTableShell warehouseListTableShell">
        <p className="warehouseTableHint" id="warehouse-list-table-hint">
          Swipe sideways to view every warehouse option.
        </p>
        <Table
          aria-describedby="warehouse-list-table-hint"
          aria-label="Warehouses"
          className="warehouseDataTable"
          containerClassName="warehouseTableViewport"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Warehouse</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="warehouseActionsCell">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehousePages.pageItems.map((warehouse) => (
              <TableRow key={warehouse.id}>
                <TableCell>
                  <Link className="warehouseNameLink" href={buildWarehouseDetailPath(warehouse.id)}>
                    <strong title={warehouse.name}>{warehouse.name}</strong>
                  </Link>
                  <em>{warehouse.code}</em>
                </TableCell>
                <TableCell>
                  <span className="warehouseCellText" title={`${warehouse.city}, ${warehouse.state}`}>
                    {warehouse.city}, {warehouse.state}
                  </span>
                  <em>{warehouse.pincode}</em>
                </TableCell>
                <TableCell>
                  <span className="warehouseCellText" title={warehouse.contactPerson}>
                    {warehouse.contactPerson}
                  </span>
                  <em>{warehouse.contactNumber}</em>
                </TableCell>
                <TableCell>
                  <StatusBadge status={warehouse.status} />
                </TableCell>
                <TableCell className="warehouseActionsCell">
                  <span className="tableActions">
                    <Button
                      asChild
                      className="tableIconButton"
                      size="icon"
                      title="View"
                      variant="outline"
                    >
                      <Link aria-label={`View ${warehouse.name}`} href={buildWarehouseDetailPath(warehouse.id)}>
                        <Eye aria-hidden size={16} />
                      </Link>
                    </Button>
                    <Button
                      aria-label={`Edit ${warehouse.name}`}
                      className="tableIconButton"
                      disabled={!canManage || isMutating}
                      onClick={() => onEdit(warehouse)}
                      size="icon"
                      title="Edit"
                      type="button"
                      variant="outline"
                    >
                      <Pencil aria-hidden size={16} />
                    </Button>
                    {warehouse.status === "ACTIVE" ? (
                      <Button
                        aria-label={`Deactivate ${warehouse.name}`}
                        className="tableIconButton"
                        disabled={!canManage || isMutating}
                        onClick={() => onDeactivate(warehouse)}
                        size="icon"
                        title="Deactivate"
                        type="button"
                        variant="outline"
                      >
                        <PowerOff aria-hidden size={16} />
                      </Button>
                    ) : (
                      <Button
                        aria-label={`Activate ${warehouse.name}`}
                        className="tableIconButton"
                        disabled={!canManage || isMutating}
                        onClick={() => onActivate(warehouse)}
                        size="icon"
                        title="Activate"
                        type="button"
                        variant="outline"
                      >
                        <Power aria-hidden size={16} />
                      </Button>
                    )}
                    {canManage ? (
                      <Button
                        aria-label={`Delete ${warehouse.name}`}
                        className="tableIconButton"
                        disabled={isMutating}
                        onClick={() => onDelete(warehouse)}
                        size="icon"
                        title="Delete"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2 aria-hidden size={16} />
                      </Button>
                    ) : null}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        ariaLabel="Warehouses pagination"
        onChange={(nextPage) => { if (!isMutating) warehousePages.setPage(nextPage); }}
        page={warehousePages.page}
        pageSize={warehousePages.pageSize}
        totalItems={warehousePages.totalItems}
        totalPages={warehousePages.totalPages}
      />
    </>
  );
}

function WarehouseStaffTable({
  assignments,
  isMutating,
  onRemove,
  scope
}: {
  assignments: WarehouseStaffAssignment[];
  isMutating: boolean;
  onRemove: (assignment: WarehouseStaffAssignment) => void;
  scope: string;
}) {
  const staffPages = useClientPagination(assignments, scope);

  return (
    <>
      <div className="resourceTable warehouseTableShell warehouseStaffTableShell">
        <p className="warehouseTableHint" id="warehouse-staff-table-hint">
          Swipe sideways to view every staff detail.
        </p>
        <Table
          aria-describedby="warehouse-staff-table-hint"
          aria-label="Assigned warehouse staff"
          className="warehouseStaffDataTable"
          containerClassName="warehouseTableViewport"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Staff member</TableHead>
              <TableHead>Admin user ID</TableHead>
              <TableHead className="warehouseActionsCell">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffPages.pageItems.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell>
                  <strong>
                    {assignment.firstName} {assignment.lastName ?? ""}
                  </strong>
                  <em>{assignment.email}</em>
                </TableCell>
                <TableCell>
                  <span className="warehouseCellText" title={assignment.adminUserId}>
                    {assignment.adminUserId}
                  </span>
                </TableCell>
                <TableCell className="warehouseActionsCell">
                  <span className="tableActions">
                    <Button
                      className="iconTextButton"
                      disabled={isMutating}
                      onClick={() => onRemove(assignment)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <UserMinus aria-hidden size={16} />
                      <span>Remove</span>
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationControls
        ariaLabel="Warehouse staff pagination"
        onChange={(nextPage) => { if (!isMutating) staffPages.setPage(nextPage); }}
        page={staffPages.page}
        pageSize={staffPages.pageSize}
        totalItems={staffPages.totalItems}
        totalPages={staffPages.totalPages}
      />
    </>
  );
}

function WarehouseFilterFields({
  content,
  filters,
  onChange
}: {
  content: ReturnType<typeof getWarehouseFilterContent>;
  filters: WarehouseFilters;
  onChange: (filters: WarehouseFilters) => void;
}) {
  return (
    <div className="filterDrawerFields">
      {filters.warehouseId ? (
        <Button
          onClick={() => onChange({ ...filters, warehouseId: "" })}
          type="button"
          variant="outline"
        >
          Clear selected warehouse
        </Button>
      ) : null}
      <Label>
        Search
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <Input
            className="filterDrawerControl"
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder={content.searchPlaceholder}
            value={filters.search}
          />
        </span>
      </Label>
      <Label>
        State
        <Input
          className="filterDrawerControl"
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
          <SelectTrigger className="filterDrawerControl">
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
    <form className="formStack warehouseForm" onSubmit={onSubmit}>
      <div className="formGrid warehouseFormGrid">
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
      <div className="actionRow warehouseFormActions">
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
