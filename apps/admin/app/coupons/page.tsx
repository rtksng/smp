"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  COUPON_TYPES,
  buildCouponPayload,
  buildCouponQuery,
  couponToFormValues,
  createEmptyCouponFilters,
  createEmptyCouponFormValues,
  formatCouponDiscount,
  formatCurrency,
  formatSupportDateTime,
  formatSupportLabel,
  validateCouponForm,
  type AdminCoupon,
  type CouponFieldErrors,
  type CouponFilters,
  type CouponFormValues,
  type CouponPayload,
  type CouponType,
  type PaginatedAdminResponse
} from "../../lib/support-management";

const PAGE_SIZE = 20;

export default function CouponsPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        <CouponsContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function CouponsContent() {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<CouponFilters>(
    createEmptyCouponFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<CouponFilters>(
    createEmptyCouponFilters()
  );
  const [page, setPage] = useState(1);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [formValues, setFormValues] = useState<CouponFormValues>(
    createEmptyCouponFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<CouponFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const couponQuery = useMemo(
    () => buildCouponQuery(appliedFilters, page, PAGE_SIZE),
    [appliedFilters, page]
  );
  const couponsQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedAdminResponse<AdminCoupon>>("/admin/coupons", {
        query: couponQuery
      }),
    queryKey: ["admin", "coupons", couponQuery]
  });
  const createMutation = useMutation({
    mutationFn: (payload: CouponPayload) =>
      api.request<AdminCoupon>("/admin/coupons", {
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
      payload: CouponPayload;
    }) =>
      api.request<AdminCoupon>(`/admin/coupons/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<AdminCoupon>(`/admin/coupons/${id}`, {
        method: "DELETE"
      })
  });
  const coupons = useMemo(
    () => couponsQuery.data?.items ?? [],
    [couponsQuery.data?.items]
  );
  const pagination = couponsQuery.data?.pagination;
  const activeVisibleCount = coupons.filter((coupon) => coupon.isActive).length;
  const inactiveVisibleCount = coupons.length - activeVisibleCount;
  const limitedVisibleCount = coupons.filter(
    (coupon) => coupon.usageLimit !== null
  ).length;
  const error =
    getErrorMessage(couponsQuery.error) ??
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
    const emptyFilters = createEmptyCouponFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  async function refreshCoupons() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
  }

  function updateFormValue<TKey extends keyof CouponFormValues>(
    key: TKey,
    value: CouponFormValues[TKey]
  ) {
    setFormValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function startEdit(coupon: AdminCoupon) {
    setEditingCoupon(coupon);
    setFieldErrors({});
    setMessage(null);
    setFormValues(couponToFormValues(coupon));
  }

  function resetForm() {
    setEditingCoupon(null);
    setFieldErrors({});
    setFormValues(createEmptyCouponFormValues());
  }

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateCouponForm(formValues);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    const payload = buildCouponPayload(formValues);

    if (editingCoupon) {
      await updateMutation.mutateAsync({
        id: editingCoupon.id,
        payload
      });
      setMessage("Coupon updated.");
    } else {
      await createMutation.mutateAsync(payload);
      setMessage("Coupon created.");
    }

    resetForm();
    await refreshCoupons();
  }

  function confirmDelete(coupon: AdminCoupon) {
    setConfirmation({
      body: `Archive coupon ${coupon.code}? Customers will no longer be able to apply it at checkout.`,
      confirmLabel: "Archive coupon",
      onConfirm: async () => {
        await deleteMutation.mutateAsync(coupon.id);
        setMessage("Coupon archived.");
        if (editingCoupon?.id === coupon.id) {
          resetForm();
        }
        await refreshCoupons();
      },
      title: "Archive coupon"
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
                onClick={() => void refreshCoupons()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            }
            eyebrow="Coupons"
            summary="Create and maintain checkout discounts with limits and active windows."
            title="Coupon management"
          />

          {message ? <p className="formSuccess">{message}</p> : null}
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : null}

          <div className="metricGrid resourceMetrics">
            <MetricCard label="Total coupons" tone="primary" value={pagination?.total ?? 0} />
            <MetricCard label="Visible" value={coupons.length} />
            <MetricCard label="Active visible" tone="primary" value={activeVisibleCount} />
            <MetricCard label="Inactive visible" tone="warning" value={inactiveVisibleCount} />
            <MetricCard label="Limited visible" value={limitedVisibleCount} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader
            eyebrow={editingCoupon ? "Edit coupon" : "New coupon"}
            level={2}
            title={editingCoupon ? editingCoupon.code : "Create coupon"}
          />
          <CouponForm
            errors={fieldErrors}
            isEditing={Boolean(editingCoupon)}
            isSaving={isSaving}
            onCancel={resetForm}
            onChange={updateFormValue}
            onSubmit={saveCoupon}
            values={formValues}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Filters" level={2} title="Find coupons" />
          <form className="productFilters customerFilters" onSubmit={applyFilters}>
            <label>
              Search
              <Input
                onChange={(event) =>
                  setDraftFilters({
                    search: event.target.value
                  })
                }
                placeholder="Coupon code"
                value={draftFilters.search}
              />
            </label>
            <div className="productFilterActions">
              <Button className="iconTextButton" type="submit">
                <Search aria-hidden size={16} />
                <span>Apply</span>
              </Button>
              <Button onClick={resetFilters} type="button" variant="outline">
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Coupon list" level={2} title="Checkout discounts" />

          {couponsQuery.isLoading ? <LoadingState label="Loading coupons..." /> : null}
          {!couponsQuery.isLoading && !couponsQuery.isError && coupons.length === 0 ? (
            <EmptyState
              body="No coupons match the current filters."
              title="No coupons found"
            />
          ) : null}
          {coupons.length > 0 ? (
            <CouponsTable
              coupons={coupons}
              isDeleting={isDeleting}
              onDelete={confirmDelete}
              onEdit={startEdit}
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

function CouponForm({
  errors,
  isEditing,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
  values
}: {
  errors: CouponFieldErrors;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: <TKey extends keyof CouponFormValues>(
    key: TKey,
    value: CouponFormValues[TKey]
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: CouponFormValues;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="formGrid">
        <TextField
          error={errors.code}
          label="Code"
          onChange={(value) => onChange("code", value)}
          placeholder="SURGICAL10"
          value={values.code}
        />
        <label>
          Type
          <Select
            aria-label="Coupon type"
            onValueChange={(value) => onChange("type", value as CouponType)}
            value={values.type}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUPON_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatSupportLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <TextField
          error={errors.value}
          label="Discount value"
          onChange={(value) => onChange("value", value)}
          placeholder={values.type === "PERCENTAGE" ? "10" : "500"}
          type="number"
          value={values.value}
        />
        <TextField
          error={errors.minOrderAmount}
          label="Minimum order amount"
          onChange={(value) => onChange("minOrderAmount", value)}
          placeholder="1000"
          type="number"
          value={values.minOrderAmount}
        />
        <TextField
          error={errors.maxDiscount}
          label="Maximum discount"
          onChange={(value) => onChange("maxDiscount", value)}
          placeholder="300"
          type="number"
          value={values.maxDiscount}
        />
        <TextField
          error={errors.usageLimit}
          label="Usage limit"
          onChange={(value) => onChange("usageLimit", value)}
          placeholder="50"
          type="number"
          value={values.usageLimit}
        />
        <TextField
          error={errors.startsAt}
          label="Starts at"
          onChange={(value) => onChange("startsAt", value)}
          type="date"
          value={values.startsAt}
        />
        <TextField
          error={errors.expiresAt}
          label="Expires at"
          onChange={(value) => onChange("expiresAt", value)}
          type="date"
          value={values.expiresAt}
        />
      </div>
      <Label className="checkField rowCheck">
        <Checkbox
          checked={values.isActive}
          onCheckedChange={(checked) => onChange("isActive", checked === true)}
        />
        <span>Active for customer checkout</span>
      </Label>
      <div className="actionRow">
        <Button className="iconTextButton" disabled={isSaving} type="submit">
          {isEditing ? <CheckCircle2 aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
          <span>{isSaving ? "Saving..." : isEditing ? "Save changes" : "Create coupon"}</span>
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

function CouponsTable({
  coupons,
  isDeleting,
  onDelete,
  onEdit
}: {
  coupons: AdminCoupon[];
  isDeleting: boolean;
  onDelete: (coupon: AdminCoupon) => void;
  onEdit: (coupon: AdminCoupon) => void;
}) {
  return (
    <div className="resourceTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Coupon</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Rules</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((coupon) => (
            <TableRow key={coupon.id}>
              <TableCell>
                <strong>{coupon.code}</strong>
                <em>{formatSupportLabel(coupon.type)}</em>
              </TableCell>
              <TableCell>{formatCouponDiscount(coupon)}</TableCell>
              <TableCell>
                <strong>Min {formatCurrency(coupon.minOrderAmount)}</strong>
                <em>Max {formatCurrency(coupon.maxDiscount)}</em>
              </TableCell>
              <TableCell>
                <strong>Start {formatSupportDateTime(coupon.startsAt)}</strong>
                <em>End {formatSupportDateTime(coupon.expiresAt)}</em>
              </TableCell>
              <TableCell>
                <strong>{coupon.usedCount} used</strong>
                <em>{coupon.usageLimit === null ? "No limit" : `${coupon.usageLimit} max`}</em>
              </TableCell>
              <TableCell>
                <StatusBadge status={coupon.isActive ? "ACTIVE" : "INACTIVE"} />
              </TableCell>
              <TableCell>
                <div className="actionRow">
                  <Button
                    aria-label={`Edit ${coupon.code}`}
                    onClick={() => onEdit(coupon)}
                    type="button"
                    variant="outline"
                  >
                    <Pencil aria-hidden size={16} />
                  </Button>
                  <Button
                    aria-label={`Archive ${coupon.code}`}
                    disabled={isDeleting}
                    onClick={() => onDelete(coupon)}
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
