"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Truck,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterDrawer } from "@/components/admin/filter-drawer";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import {
  buildDeliveryChargePayload,
  buildDeliveryChargeQuery,
  createEmptyDeliveryChargeFilters,
  createEmptyDeliveryChargeFormValues,
  deliveryChargeRuleToFormValues,
  formatCurrency,
  formatDeliveryDateTime,
  formatDeliveryRange,
  formatDeliveryScope,
  validateDeliveryChargeFilters,
  validateDeliveryChargeForm,
  type AdminDeliveryChargeRule,
  type DeliveryChargeFieldErrors,
  type DeliveryChargeFilters,
  type DeliveryChargeFormValues,
  type DeliveryChargePayload,
  type PaginatedDeliveryChargeResponse
} from "../../../lib/delivery-charge-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import type { WarehouseListResponse } from "../../../lib/warehouse-management";

const PAGE_SIZE = 20;

type DeliveryChargeView = "rules" | "new";
type DeliveryChargeWarehouse = Pick<WarehouseListResponse["items"][number], "id" | "name" | "code">;

const deliveryChargeSections: Array<{
  description: string;
  href: string;
  id: DeliveryChargeView;
  title: string;
}> = [
  {
    description: "Search, filter, edit, archive, and review checkout delivery fees.",
    href: "/delivery-charges/rules",
    id: "rules",
    title: "Rules"
  },
  {
    description: "Create a new pincode, warehouse, or order-value based rule.",
    href: "/delivery-charges/new",
    id: "new",
    title: "New rule"
  }
];

const deliveryChargeCopy: Record<
  DeliveryChargeView,
  { summary: string; title: string }
> = {
  new: {
    summary: "Create one focused rule without the table, filters, and edit state competing for space.",
    title: "Create delivery charge rule"
  },
  rules: {
    summary: "Search, filter, edit, and archive delivery charge rules in a table-first workspace.",
    title: "Delivery charge rules"
  }
};

export function DeliveryChargesRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function DeliveryChargeRulesPage() {
  return <DeliveryChargesContent view="rules" />;
}

export function DeliveryChargeCreatePage() {
  return <DeliveryChargesContent view="new" />;
}

function DeliveryChargesContent({ view }: { view: DeliveryChargeView }) {
  const { api, hasPermission } = useAdminSession();
  const canReadWarehouses = hasPermission(ADMIN_PERMISSION.WarehouseRead);
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<DeliveryChargeFilters>(
    createEmptyDeliveryChargeFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<DeliveryChargeFilters>(
    createEmptyDeliveryChargeFilters()
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editingRule, setEditingRule] = useState<AdminDeliveryChargeRule | null>(
    null
  );
  const [formValues, setFormValues] = useState<DeliveryChargeFormValues>(
    createEmptyDeliveryChargeFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<DeliveryChargeFieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const ruleQuery = useMemo(
    () => buildDeliveryChargeQuery(appliedFilters, page, PAGE_SIZE),
    [appliedFilters, page]
  );
  const rulesQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedDeliveryChargeResponse>(
        "/admin/delivery-charge-rules",
        {
          query: ruleQuery
        }
      ),
    queryKey: ["admin", "delivery-charge-rules", ruleQuery]
  });
  const warehousesQuery = useQuery({
    enabled: canReadWarehouses,
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: {
          limit: 100,
          status: "ACTIVE"
        }
      }),
    queryKey: ["admin", "warehouses", "active"]
  });
  const createMutation = useMutation({
    mutationFn: (payload: DeliveryChargePayload) =>
      api.request<AdminDeliveryChargeRule>("/admin/delivery-charge-rules", {
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
      payload: DeliveryChargePayload;
    }) =>
      api.request<AdminDeliveryChargeRule>(`/admin/delivery-charge-rules/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<AdminDeliveryChargeRule>(`/admin/delivery-charge-rules/${id}`, {
        method: "DELETE"
      })
  });
  const rules = useMemo(() => rulesQuery.data?.items ?? [], [rulesQuery.data?.items]);
  const warehouses = useMemo(() => {
    const options = new Map<string, DeliveryChargeWarehouse>();
    for (const warehouse of [
      ...(warehousesQuery.data?.items ?? []),
      ...rules.flatMap((rule) => rule.warehouse ? [rule.warehouse] : []),
      ...(editingRule?.warehouse ? [editingRule.warehouse] : [])
    ]) {
      options.set(warehouse.id, warehouse);
    }
    if (draftFilters.warehouseId && !options.has(draftFilters.warehouseId)) {
      options.set(draftFilters.warehouseId, { id: draftFilters.warehouseId, code: "", name: "Selected warehouse" });
    }
    return [...options.values()];
  }, [warehousesQuery.data?.items, rules, editingRule, draftFilters.warehouseId]);
  const pagination = rulesQuery.data?.pagination;
  const activeVisibleCount = rules.filter((rule) => rule.isActive).length;
  const pincodeVisibleCount = rules.filter((rule) => rule.pincode !== null).length;
  const warehouseVisibleCount = rules.filter(
    (rule) => rule.warehouseId !== null
  ).length;
  const error =
    getErrorMessage(rulesQuery.error) ??
    getErrorMessage(warehousesQuery.error) ??
    saveError;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  useEffect(() => {
    if (pagination && page > Math.max(pagination.totalPages, 1)) {
      setPage(Math.max(pagination.totalPages, 1));
    }
  }, [page, pagination]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilterError = validateDeliveryChargeFilters(draftFilters);
    setFilterError(nextFilterError);
    if (nextFilterError) {
      return;
    }
    setPage(1);
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
  }

  function resetFilters() {
    const emptyFilters = createEmptyDeliveryChargeFilters();
    setFilterError(null);
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  async function refreshRules() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin", "delivery-charge-rules"]
      }),
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] })
    ]);
  }

  function updateFormValue<TKey extends keyof DeliveryChargeFormValues>(
    key: TKey,
    value: DeliveryChargeFormValues[TKey]
  ) {
    if (isSaving) return;
    setFormValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function startEdit(rule: AdminDeliveryChargeRule) {
    if (isSaving || isDeleting) return;
    setEditingRule(rule);
    setFieldErrors({});
    setMessage(null);
    setSaveError(null);
    setFormValues(deliveryChargeRuleToFormValues(rule));
  }

  function resetForm() {
    if (isSaving) return;
    setEditingRule(null);
    setFieldErrors({});
    setSaveError(null);
    setFormValues(createEmptyDeliveryChargeFormValues());
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    setMessage(null);
    setSaveError(null);
    const errors = validateDeliveryChargeForm(formValues);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    const payload = buildDeliveryChargePayload(formValues);

    try {
      if (editingRule) {
        await updateMutation.mutateAsync({
          id: editingRule.id,
          payload
        });
        setMessage("Delivery charge rule updated.");
      } else {
        await createMutation.mutateAsync(payload);
        setMessage("Delivery charge rule created.");
      }

      resetForm();
      await refreshRules();
    } catch (error) {
      setSaveError(getErrorMessage(error) ?? "Unable to save the delivery charge rule. Please try again.");
    }
  }

  function confirmDelete(rule: AdminDeliveryChargeRule) {
    if (isSaving || isDeleting) return;
    setConfirmation({
      body: `Archive ${rule.name}? Matching carts and new orders will stop using this delivery charge rule.`,
      confirmLabel: "Archive rule",
      onConfirm: async () => {
        setMessage(null);
        await deleteMutation.mutateAsync(rule.id);
        setMessage("Delivery charge rule archived.");

        if (editingRule?.id === rule.id) {
          resetForm();
        }

        await refreshRules();
      },
      title: "Archive delivery charge rule"
    });
  }

  const pageCopy = deliveryChargeCopy[view];
  const editingRuleForPanel = view === "rules" ? editingRule : null;

  return (
    <>
      <section className="panel deliveryChargeOverviewPanel">
        <DeliveryChargeSectionNav active={view} />
        <PageHeader
          actions={
            <div className="actionRow">
              {view === "new" ? (
                <Button asChild className="iconTextButton" variant="outline">
                  <Link href="/delivery-charges/rules">
                    <Truck aria-hidden size={16} />
                    <span>View rules</span>
                  </Link>
                </Button>
              ) : (
                <Button asChild className="iconTextButton">
                  <Link href="/delivery-charges/new">
                    <Plus aria-hidden size={16} />
                    <span>New rule</span>
                  </Link>
                </Button>
              )}
              <Button
                className="iconTextButton"
                onClick={() => void refreshRules()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="deliveryChargePageHeader"
          eyebrow="Delivery charges"
          summary={pageCopy.summary}
          title={pageCopy.title}
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}

        {view === "rules" ? (
          <div className="metricGrid resourceMetrics deliveryChargeMetricGrid">
            <MetricCard label="Total rules" tone="primary" value={pagination?.total ?? 0} />
            <MetricCard label="Visible" value={rules.length} />
            <MetricCard label="Active visible" value={activeVisibleCount} />
            <MetricCard label="Pincode rules" value={pincodeVisibleCount} />
            <MetricCard label="Warehouse rules" value={warehouseVisibleCount} />
          </div>
        ) : null}
      </section>

      {view === "rules" ? (
        <FilterDrawer
          error={filterError}
          isOpen={isFilterDrawerOpen}
          isSubmitting={rulesQuery.isFetching}
          onApply={applyFilters}
          onOpenChange={setIsFilterDrawerOpen}
          onReset={resetFilters}
          title="Delivery charge filters"
        >
          <DeliveryChargeFilterFields
            filters={draftFilters}
            isWarehouseLoading={canReadWarehouses && warehousesQuery.isLoading}
            onChange={setDraftFilters}
            warehouses={warehouses}
          />
        </FilterDrawer>
      ) : null}

      {view === "new" ? (
        <section className="panel deliveryChargeFormPanel deliveryChargeFormOnlyPanel mt-3">
          <DeliveryChargeForm
            errors={fieldErrors}
            isEditing={false}
            isSaving={isSaving}
            onCancel={resetForm}
            onChange={updateFormValue}
            onSubmit={saveRule}
            values={formValues}
            warehouses={warehouses}
          />
        </section>
      ) : null}

      {view === "rules" ? (
        <div
          className={
            editingRuleForPanel
              ? "deliveryChargeWorkspaceGrid"
              : "deliveryChargeWorkspaceGrid deliveryChargeWorkspaceGrid--single"
          }
        >
          <section className="panel deliveryChargeRulesPanel mt-3 ">
            <PageHeader
              actions={
                <Button
                  className="iconTextButton"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  type="button"
                >
                  <SlidersHorizontal aria-hidden size={16} />
                  <span>Add filter</span>
                </Button>
              }
              className="settingsSectionHeader"
              eyebrow="Rule list"
              level={2}
              summary="Use filters first, then edit or archive rules directly from the table."
              title="Checkout shipping fees"
            />

            {rulesQuery.isLoading ? (
              <LoadingState label="Loading delivery charge rules..." />
            ) : null}
            {!rulesQuery.isLoading && !rulesQuery.isError && rules.length === 0 ? (
              <EmptyState
                body="No delivery charge rules match the current filters."
                title="No delivery charge rules found"
              />
            ) : null}
            {rules.length > 0 ? (
              <DeliveryChargeRulesTable
                isSaving={isSaving}
                isDeleting={isDeleting}
                onDelete={confirmDelete}
                onEdit={startEdit}
                rules={rules}
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

          {editingRuleForPanel ? (
            <aside className="panel deliveryChargeFormPanel">
              <PageHeader
                actions={
                  <Button
                    className="iconTextButton"
                    disabled={isSaving}
                    onClick={resetForm}
                    type="button"
                    variant="outline"
                  >
                    <X aria-hidden size={16} />
                    <span>Close</span>
                  </Button>
                }
                className="settingsSectionHeader"
                eyebrow="Edit rule"
                level={2}
                summary="Changes apply to matching carts and future orders after save."
                title={editingRuleForPanel.name}
              />
              <DeliveryChargeForm
                errors={fieldErrors}
                isEditing
                isSaving={isSaving}
                onCancel={resetForm}
                onChange={updateFormValue}
                onSubmit={saveRule}
                values={formValues}
                warehouses={warehouses}
              />
            </aside>
          ) : null}
        </div>
      ) : null}

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isDeleting}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function DeliveryChargeSectionNav({ active }: { active: DeliveryChargeView }) {
  return (
    <nav className="deliveryChargeSectionNav" aria-label="Delivery charge sections">
      {deliveryChargeSections.map((section) => (
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

function DeliveryChargeForm({
  errors,
  isEditing,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  values,
  warehouses
}: {
  errors: DeliveryChargeFieldErrors;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: <TKey extends keyof DeliveryChargeFormValues>(
    key: TKey,
    value: DeliveryChargeFormValues[TKey]
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: DeliveryChargeFormValues;
  warehouses: DeliveryChargeWarehouse[];
}) {
  return (
    <form className="formStack productForm deliveryChargeForm" onSubmit={onSubmit}>
      <div className="formGrid">
        <TextField
          error={errors.name}
          label="Rule name"
          onChange={(value) => onChange("name", value)}
          placeholder="Delhi local delivery"
          value={values.name}
        />
        <TextField
          error={errors.charge}
          label="Delivery charge"
          onChange={(value) => onChange("charge", value)}
          placeholder="75"
          type="number"
          value={values.charge}
        />
        <TextField
          error={errors.pincode}
          label="Pincode"
          onChange={(value) => onChange("pincode", value)}
          placeholder="Blank for all"
          value={values.pincode}
        />
        <label>
          Warehouse
          <Select
            aria-label="Warehouse"
            onValueChange={(value) => onChange("warehouseId", value)}
            value={values.warehouseId}
          >
            <SelectTrigger>
              <SelectValue placeholder="All warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All warehouses</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem
                  key={warehouse.id}
                  textValue={`${warehouse.code} ${warehouse.name}`}
                  value={warehouse.id}
                >
                  {warehouse.code} - {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <TextField
          error={errors.minOrderAmount}
          label="Minimum order amount"
          onChange={(value) => onChange("minOrderAmount", value)}
          placeholder="Blank for no minimum"
          type="number"
          value={values.minOrderAmount}
        />
        <TextField
          error={errors.maxOrderAmount}
          label="Maximum order amount"
          onChange={(value) => onChange("maxOrderAmount", value)}
          placeholder="Blank for no maximum"
          type="number"
          value={values.maxOrderAmount}
        />
        <TextField
          error={errors.freeDeliveryThreshold}
          label="Free delivery threshold"
          onChange={(value) => onChange("freeDeliveryThreshold", value)}
          placeholder="Blank to always charge"
          type="number"
          value={values.freeDeliveryThreshold}
        />
        <TextField
          error={errors.priority}
          label="Priority"
          onChange={(value) => onChange("priority", value)}
          placeholder="0"
          step="1"
          type="number"
          value={values.priority}
        />
      </div>
      <Label className="checkField rowCheck">
        <Checkbox
          checked={values.isActive}
          onCheckedChange={(checked) => onChange("isActive", checked === true)}
        />
        <span>Active for checkout</span>
      </Label>
      <div className="actionRow">
        <Button className="iconTextButton" disabled={isSaving} type="submit">
          {isEditing ? <CheckCircle2 aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
          <span>{isSaving ? "Saving..." : isEditing ? "Save changes" : "Create rule"}</span>
        </Button>
        {isEditing ? (
          <Button
            className="iconTextButton"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            <X aria-hidden size={16} />
            <span>Cancel edit</span>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function DeliveryChargeFilterFields({
  filters,
  isWarehouseLoading,
  onChange,
  warehouses
}: {
  filters: DeliveryChargeFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: DeliveryChargeFilters) => void;
  warehouses: DeliveryChargeWarehouse[];
}) {
  return (
    <div className="filterDrawerFields">
      <label>
        Search
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Rule name"
          value={filters.search}
        />
      </label>
      <label>
        Pincode
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, pincode: event.target.value })}
          placeholder="110001"
          value={filters.pincode}
        />
      </label>
      <Select
        aria-label="Warehouse"
        disabled={isWarehouseLoading}
        onValueChange={(value) => onChange({ ...filters, warehouseId: value })}
        value={filters.warehouseId}
      >
        <SelectTrigger className="filterDrawerControl">
          <SelectValue placeholder="Any warehouse" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any warehouse</SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem
              key={warehouse.id}
              textValue={`${warehouse.code} ${warehouse.name}`}
              value={warehouse.id}
            >
              {warehouse.code} - {warehouse.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        aria-label="Status"
        onValueChange={(value) =>
          onChange({
            ...filters,
            isActive: value as DeliveryChargeFilters["isActive"]
          })
        }
        value={filters.isActive}
      >
        <SelectTrigger className="filterDrawerControl">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any status</SelectItem>
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function DeliveryChargeRulesTable({
  isDeleting,
  isSaving,
  onDelete,
  onEdit,
  rules
}: {
  isDeleting: boolean;
  isSaving: boolean;
  onDelete: (rule: AdminDeliveryChargeRule) => void;
  onEdit: (rule: AdminDeliveryChargeRule) => void;
  rules: AdminDeliveryChargeRule[];
}) {
  return (
    <div className="resourceTable deliveryChargeRulesTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule</TableHead>
            <TableHead>Charge</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Order range</TableHead>
            <TableHead>Free threshold</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                <strong>{rule.name}</strong>
                <em>Priority {rule.priority}</em>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Truck aria-hidden size={14} />
                  {formatCurrency(rule.charge)}
                </span>
              </TableCell>
              <TableCell>
                <strong>{formatDeliveryScope(rule)}</strong>
                <em>{rule.warehouse?.name ?? "No warehouse restriction"}</em>
              </TableCell>
              <TableCell>{formatDeliveryRange(rule)}</TableCell>
              <TableCell>{formatCurrency(rule.freeDeliveryThreshold)}</TableCell>
              <TableCell>
                <StatusBadge status={rule.isActive ? "ACTIVE" : "INACTIVE"} />
              </TableCell>
              <TableCell>{formatDeliveryDateTime(rule.updatedAt)}</TableCell>
              <TableCell>
                <div className="tableActions">
                  <Button
                    aria-label={`Edit ${rule.name}`}
                    className="iconTextButton"
                    disabled={isSaving || isDeleting}
                    onClick={() => onEdit(rule)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Pencil aria-hidden size={16} />
                    <span>Edit</span>
                  </Button>
                  <Button
                    aria-label={`Archive ${rule.name}`}
                    className="iconTextButton"
                    disabled={isSaving || isDeleting}
                    onClick={() => onDelete(rule)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 aria-hidden size={16} />
                    <span>Archive</span>
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

function TextField({
  error,
  label,
  onChange,
  placeholder,
  step,
  type = "text",
  value
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: string;
  type?: string;
  value: string;
}) {
  return (
    <label>
      {label}
      <Input
        aria-label={label}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step={type === "number" ? step ?? "0.01" : undefined}
        type={type}
        value={value}
      />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
