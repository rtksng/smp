"use client";

import { BulkActions, BulkPageCheckbox, BulkRowCheckbox } from "@/components/admin/bulk-actions";
import { loadBulkRows } from "@/lib/bulk-actions";
import { useBulkSelection, type BulkSelection } from "@/lib/use-bulk-selection";
import { activeResourceBulkActions } from "@/lib/bulk-resource-actions";

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
import Link from "next/link";
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import {
  COUPON_TYPES,
  buildCouponPayload,
  buildCouponQuery,
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
} from "../../../lib/support-management";

const PAGE_SIZE = 20;

type CouponView = "coupons" | "new";

const couponSections: Array<{
  description: string;
  href: string;
  id: CouponView;
  title: string;
}> = [
  {
    description: "Search, filter, edit, archive, and review checkout discounts.",
    href: "/coupons/list",
    id: "coupons",
    title: "Coupons"
  },
  {
    description: "Create a new checkout discount with limits and active windows.",
    href: "/coupons/new",
    id: "new",
    title: "New coupon"
  }
];

const couponCopy: Record<CouponView, { summary: string; title: string }> = {
  coupons: {
    summary: "Search, filter, edit, and archive coupon records in a table-first workspace.",
    title: "Coupon list"
  },
  new: {
    summary: "Create one checkout discount without the table and filters competing for space.",
    title: "Create coupon"
  }
};

export function CouponsRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function CouponListPage() {
  return <CouponsContent view="coupons" />;
}

export function CouponCreatePage() {
  return <CouponsContent view="new" />;
}

function CouponsContent({ view }: { view: CouponView }) {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<CouponFilters>(
    createEmptyCouponFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<CouponFilters>(
    createEmptyCouponFilters()
  );
  const [page, setPage] = useState(1);
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
  const bulk = useBulkSelection(JSON.stringify(appliedFilters), coupons);
  const pagination = couponsQuery.data?.pagination;
  useEffect(() => {
    if (pagination && page > Math.max(pagination.totalPages, 1)) setPage(Math.max(pagination.totalPages, 1));
  }, [page, pagination]);
  const activeVisibleCount = coupons.filter((coupon) => coupon.isActive).length;
  const inactiveVisibleCount = coupons.length - activeVisibleCount;
  const limitedVisibleCount = coupons.filter(
    (coupon) => coupon.usageLimit !== null
  ).length;
  const error =
    getErrorMessage(couponsQuery.error) ??
    getErrorMessage(createMutation.error) ??
    getErrorMessage(deleteMutation.error);
  const isSaving = createMutation.isPending;
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

  function resetForm() {
    setFieldErrors({});
    setFormValues(createEmptyCouponFormValues());
  }

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setMessage(null);
    const errors = validateCouponForm(formValues);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    const payload = buildCouponPayload(formValues);

    try {
      await createMutation.mutateAsync(payload);
      setMessage("Coupon created.");
      resetForm();
      await refreshCoupons();
    } catch {
      // The mutation error is displayed above the form; preserve the entered values.
    }
  }

  function confirmDelete(coupon: AdminCoupon) {
    setConfirmation({
      body: `Archive coupon ${coupon.code}? Customers will no longer be able to apply it at checkout.`,
      confirmLabel: "Archive coupon",
      onConfirm: async () => {
        await deleteMutation.mutateAsync(coupon.id);
        setMessage("Coupon archived.");
        await refreshCoupons();
      },
      title: "Archive coupon"
    });
  }

  const pageCopy = couponCopy[view];

  return (
    <>
      <section className="panel couponOverviewPanel">
        <CouponSectionNav active={view} />
        <PageHeader
          actions={
            <div className="actionRow">
              {view === "new" ? (
                <Button asChild className="iconTextButton" variant="outline">
                  <Link href="/coupons/list">
                    <Search aria-hidden size={16} />
                    <span>View coupons</span>
                  </Link>
                </Button>
              ) : (
                <Button asChild className="iconTextButton">
                  <Link href="/coupons/new">
                    <Plus aria-hidden size={16} />
                    <span>New coupon</span>
                  </Link>
                </Button>
              )}
              <Button
                className="iconTextButton"
                onClick={() => void refreshCoupons()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="couponPageHeader"
          eyebrow="Coupons"
          summary={pageCopy.summary}
          title={pageCopy.title}
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}

        {view === "coupons" ? (
          <div className="metricGrid resourceMetrics couponMetricGrid">
            <MetricCard label="Total coupons" tone="primary" value={pagination?.total ?? 0} />
            <MetricCard label="Visible" value={coupons.length} />
            <MetricCard label="Active visible" tone="primary" value={activeVisibleCount} />
            <MetricCard label="Inactive visible" tone="warning" value={inactiveVisibleCount} />
            <MetricCard label="Limited visible" value={limitedVisibleCount} />
          </div>
        ) : null}
      </section>

      {view === "new" ? (
        <section className="panel couponFormPanel couponFormOnlyPanel mt-3">
          <CouponForm
            errors={fieldErrors}
            isEditing={false}
            isSaving={isSaving}
            onCancel={resetForm}
            onChange={updateFormValue}
            onSubmit={saveCoupon}
            values={formValues}
          />
        </section>
      ) : null}

      {view === "coupons" ? (
        <div className="couponWorkspaceGrid couponWorkspaceGrid--single">
          <section className="panel couponListPanel mt-3">
            <PageHeader
              className="settingsSectionHeader"
              eyebrow="Coupon list"
              level={2}
              summary="Filter first, then edit or archive coupon records from the table."
              title="Checkout discounts"
            />

            <CouponFiltersForm
              filters={draftFilters}
              onChange={setDraftFilters}
              onReset={resetFilters}
              onSubmit={applyFilters}
            />

            {couponsQuery.isLoading ? <LoadingState label="Loading coupons..." /> : null}
            <BulkActions key={bulk.scope} selection={bulk} actions={activeResourceBulkActions<AdminCoupon>(api, "coupons")} total={pagination?.total ?? 0}
              disabled={couponsQuery.isFetching || couponsQuery.isError || isSaving || isDeleting}
              loadAll={() => loadBulkRows((next, limit) => api.request<PaginatedAdminResponse<AdminCoupon>>("/admin/coupons", { query: buildCouponQuery(appliedFilters, next, limit) }))}
              getLabel={(coupon) => coupon.code} onComplete={refreshCoupons} />
            {!couponsQuery.isLoading && !couponsQuery.isError && coupons.length === 0 ? (
              <EmptyState
                body="No coupons match the current filters."
                title="No coupons found"
              />
            ) : null}
            {coupons.length > 0 ? (
              <CouponsTable
                bulk={bulk}
                coupons={coupons}
                isDeleting={isDeleting || bulk.isBusy}
                onDelete={confirmDelete}
              />
            ) : null}
            {pagination ? (
              <PaginationControls
                onChange={(next) => { if (!bulk.isBusy) setPage(next); }}
                page={pagination.page}
                totalPages={Math.max(pagination.totalPages, 1)}
              />
            ) : null}
          </section>

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

export function CouponSectionNav({ active }: { active: CouponView }) {
  return (
    <nav className="couponSectionNav" aria-label="Coupon sections">
      {couponSections.map((section) => (
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

function CouponFiltersForm({
  filters,
  onChange,
  onReset,
  onSubmit
}: {
  filters: CouponFilters;
  onChange: (filters: CouponFilters) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="productFilters couponFilters" onSubmit={onSubmit}>
      <label>
        Search
        <Input
          onChange={(event) =>
            onChange({
              search: event.target.value
            })
          }
          placeholder="Coupon code"
          maxLength={64}
          value={filters.search}
        />
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

export function CouponForm({
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
    <form className="formStack productForm couponForm" noValidate onSubmit={onSubmit}>
      <fieldset className="formStack m-0 min-w-0 border-0 p-0" disabled={isSaving}>
      <div className="formGrid">
        <TextField
          error={errors.code}
          label="Code"
          maxLength={64}
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
          min={0.01}
          step={0.01}
          onChange={(value) => onChange("value", value)}
          placeholder={values.type === "PERCENTAGE" ? "10" : "500"}
          type="number"
          value={values.value}
        />
        <TextField
          error={errors.minOrderAmount}
          label="Minimum order amount"
          min={0}
          step={0.01}
          onChange={(value) => onChange("minOrderAmount", value)}
          placeholder="1000"
          type="number"
          value={values.minOrderAmount}
        />
        <TextField
          error={errors.maxDiscount}
          label="Maximum discount"
          min={0}
          step={0.01}
          onChange={(value) => onChange("maxDiscount", value)}
          placeholder="300"
          type="number"
          value={values.maxDiscount}
        />
        <TextField
          error={errors.usageLimit}
          label="Usage limit"
          min={1}
          step={1}
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
      </fieldset>
    </form>
  );
}

function CouponsTable({
  bulk,
  coupons,
  isDeleting,
  onDelete
}: {
  bulk: BulkSelection<AdminCoupon>;
  coupons: AdminCoupon[];
  isDeleting: boolean;
  onDelete: (coupon: AdminCoupon) => void;
}) {
  return (
    <div className="resourceTable couponTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="bulkCheckboxCell"><BulkPageCheckbox selection={bulk} /></TableHead>
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
              <TableCell className="bulkCheckboxCell"><BulkRowCheckbox selection={bulk} item={coupon} label={coupon.code} /></TableCell>
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
                <div className="tableActions">
                  <Button
                    asChild
                    className="iconTextButton"
                    size="sm"
                    variant="outline"
                  >
                    <Link
                      aria-label={`Edit ${coupon.code}`}
                      href={`/coupons/${encodeURIComponent(coupon.id)}/edit`}
                    >
                      <Pencil aria-hidden size={16} />
                      <span>Edit</span>
                    </Link>
                  </Button>
                  <Button
                    aria-label={`Archive ${coupon.code}`}
                    className="iconTextButton"
                    disabled={isDeleting}
                    onClick={() => onDelete(coupon)}
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
  maxLength,
  min,
  onChange,
  placeholder,
  step,
  type = "text",
  value
}: {
  error?: string;
  label: string;
  maxLength?: number;
  min?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: number;
  type?: string;
  value: string;
}) {
  const errorId = useId();
  return (
    <label>
      {label}
      <Input
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        maxLength={maxLength}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step={step}
        type={type}
        value={value}
      />
      {error ? <span className="fieldError" id={errorId}>{error}</span> : null}
    </label>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
