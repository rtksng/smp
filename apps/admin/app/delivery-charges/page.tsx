"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  X
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { AdminShell } from "../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
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
  validateDeliveryChargeForm,
  type AdminDeliveryChargeRule,
  type DeliveryChargeFieldErrors,
  type DeliveryChargeFilters,
  type DeliveryChargeFormValues,
  type DeliveryChargePayload,
  type PaginatedDeliveryChargeResponse
} from "../../lib/delivery-charge-management";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import type { WarehouseListResponse } from "../../lib/warehouse-management";

const PAGE_SIZE = 20;

export default function DeliveryChargesPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        <DeliveryChargesContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function DeliveryChargesContent() {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<DeliveryChargeFilters>(
    createEmptyDeliveryChargeFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<DeliveryChargeFilters>(
    createEmptyDeliveryChargeFilters()
  );
  const [page, setPage] = useState(1);
  const [editingRule, setEditingRule] = useState<AdminDeliveryChargeRule | null>(
    null
  );
  const [formValues, setFormValues] = useState<DeliveryChargeFormValues>(
    createEmptyDeliveryChargeFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<DeliveryChargeFieldErrors>({});
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
  const warehouses = warehousesQuery.data?.items ?? [];
  const pagination = rulesQuery.data?.pagination;
  const activeVisibleCount = rules.filter((rule) => rule.isActive).length;
  const pincodeVisibleCount = rules.filter((rule) => rule.pincode !== null).length;
  const warehouseVisibleCount = rules.filter(
    (rule) => rule.warehouseId !== null
  ).length;
  const error =
    getErrorMessage(rulesQuery.error) ??
    getErrorMessage(warehousesQuery.error) ??
    getErrorMessage(createMutation.error) ??
    getErrorMessage(updateMutation.error) ??
    getErrorMessage(deleteMutation.error);
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    const emptyFilters = createEmptyDeliveryChargeFilters();
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
    setFormValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function startEdit(rule: AdminDeliveryChargeRule) {
    setEditingRule(rule);
    setFieldErrors({});
    setMessage(null);
    setFormValues(deliveryChargeRuleToFormValues(rule));
  }

  function resetForm() {
    setEditingRule(null);
    setFieldErrors({});
    setFormValues(createEmptyDeliveryChargeFormValues());
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateDeliveryChargeForm(formValues);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    const payload = buildDeliveryChargePayload(formValues);

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
  }

  function confirmDelete(rule: AdminDeliveryChargeRule) {
    setConfirmation({
      body: `Archive ${rule.name}? Matching carts and new orders will stop using this delivery charge rule.`,
      confirmLabel: "Archive rule",
      onConfirm: async () => {
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

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <PageHeader
            actions={
              <Button
                className="iconTextButton"
                onClick={() => void refreshRules()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            }
            eyebrow="Delivery charges"
            summary="Configure shipping fees by pincode, warehouse, and order value."
            title="Delivery charge rules"
          />

          {message ? <p className="formSuccess">{message}</p> : null}
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : null}

          <div className="metricGrid resourceMetrics">
            <MetricCard
              label="Total rules"
              tone="primary"
              value={pagination?.total ?? 0}
            />
            <MetricCard label="Visible" value={rules.length} />
            <MetricCard label="Active visible" value={activeVisibleCount} />
            <MetricCard label="Pincode rules" value={pincodeVisibleCount} />
            <MetricCard label="Warehouse rules" value={warehouseVisibleCount} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader
            eyebrow={editingRule ? "Edit rule" : "New rule"}
            level={2}
            title={editingRule ? editingRule.name : "Create delivery charge rule"}
          />
          <DeliveryChargeForm
            errors={fieldErrors}
            isEditing={Boolean(editingRule)}
            isSaving={isSaving}
            onCancel={resetForm}
            onChange={updateFormValue}
            onSubmit={saveRule}
            values={formValues}
            warehouses={warehouses}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Filters" level={2} title="Find rules" />
          <DeliveryChargeFiltersForm
            filters={draftFilters}
            onChange={setDraftFilters}
            onReset={resetFilters}
            onSubmit={applyFilters}
            warehouses={warehouses}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Rule list" level={2} title="Checkout shipping fees" />

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
        </CardContent>
      </Card>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isDeleting}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
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
  warehouses: WarehouseListResponse["items"];
}) {
  return (
    <form onSubmit={onSubmit}>
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
                <SelectItem key={warehouse.id} value={warehouse.id}>
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

function DeliveryChargeFiltersForm({
  filters,
  onChange,
  onReset,
  onSubmit,
  warehouses
}: {
  filters: DeliveryChargeFilters;
  onChange: (filters: DeliveryChargeFilters) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  warehouses: WarehouseListResponse["items"];
}) {
  return (
    <form className="productFilters customerFilters" onSubmit={onSubmit}>
      <label>
        Search
        <Input
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Rule name"
          value={filters.search}
        />
      </label>
      <label>
        Pincode
        <Input
          onChange={(event) => onChange({ ...filters, pincode: event.target.value })}
          placeholder="110001"
          value={filters.pincode}
        />
      </label>
      <Select
        aria-label="Warehouse filter"
        onValueChange={(value) => onChange({ ...filters, warehouseId: value })}
        value={filters.warehouseId}
      >
        <SelectTrigger>
          <SelectValue placeholder="Any warehouse" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any warehouse</SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.code} - {warehouse.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        aria-label="Status filter"
        onValueChange={(value) =>
          onChange({
            ...filters,
            isActive: value as DeliveryChargeFilters["isActive"]
          })
        }
        value={filters.isActive}
      >
        <SelectTrigger>
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any status</SelectItem>
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Inactive</SelectItem>
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

function DeliveryChargeRulesTable({
  isDeleting,
  onDelete,
  onEdit,
  rules
}: {
  isDeleting: boolean;
  onDelete: (rule: AdminDeliveryChargeRule) => void;
  onEdit: (rule: AdminDeliveryChargeRule) => void;
  rules: AdminDeliveryChargeRule[];
}) {
  return (
    <div className="resourceTable">
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
                <div className="actionRow">
                  <Button
                    aria-label={`Edit ${rule.name}`}
                    onClick={() => onEdit(rule)}
                    type="button"
                    variant="outline"
                  >
                    <Pencil aria-hidden size={16} />
                  </Button>
                  <Button
                    aria-label={`Archive ${rule.name}`}
                    disabled={isDeleting}
                    onClick={() => onDelete(rule)}
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 aria-hidden size={16} />
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
  type = "text",
  value
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label>
      {label}
      <Input
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
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
