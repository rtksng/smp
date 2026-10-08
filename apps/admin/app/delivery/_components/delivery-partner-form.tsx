"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { PageHeader } from "@/components/admin/page-header";
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
import { useAdminSession } from "../../../lib/admin-session";
import {
  buildDeliveryPartnerPayload,
  createEmptyDeliveryPartnerForm,
  deliveryPartnerToFormValues,
  DELIVERY_PARTNER_NAME_MAX_LENGTH,
  DELIVERY_PARTNER_VEHICLE_MAX_LENGTH,
  formatDeliveryPartnerPay,
  formatDeliveryWarehouseName,
  getDeliveryPartnerWarehouseMode,
  loadDeliveryOptions,
  validateDeliveryPartnerForm,
  type AdminDeliveryPartner,
  type DeliveryCommissionType,
  type DeliveryPartnerFieldErrors,
  type DeliveryPartnerFormOptions,
  type DeliveryPartnerFormValues,
  type DeliveryPartnerPayload,
  type DeliveryPartnerPaymentType,
  type DeliveryPartnerWarehouse,
  type DeliveryPartnerWarehouseMode
} from "../../../lib/delivery-management";
import { notify } from "../../../lib/notifications";
import { ADMIN_PERMISSION, ADMIN_ROLE } from "../../../lib/permissions";
import type { WarehouseListResponse } from "../../../lib/warehouse-management";
import "../delivery-responsive.css";

type WarehouseOption = Pick<DeliveryPartnerWarehouse, "city" | "code" | "id" | "name" | "state">;

const PARTNERS_PATH = "/delivery/partners";

export function DeliveryPartnerCreatePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading partner form..." />}>
      <DeliveryPartnerCreateContent />
    </Suspense>
  );
}

function DeliveryPartnerCreateContent() {
  const requestedWarehouseId = useSearchParams().get("warehouseId") ?? "";
  const { admin, hasPermission } = useAdminSession();
  const isSuperAdmin = admin?.role.code === ADMIN_ROLE.SuperAdmin;
  const canManagePartners = hasPermission(ADMIN_PERMISSION.DeliveryPartnersManage);
  const warehouseMode = getDeliveryPartnerWarehouseMode(isSuperAdmin, false);
  const warehousesQuery = usePartnerWarehouseOptions(
    canManagePartners && hasPermission(ADMIN_PERMISSION.WarehouseRead)
  );
  const warehouseOptions = warehousesQuery.data ?? [];

  return (
    <DeliveryPartnerFormShell
      backHref={PARTNERS_PATH}
      backLabel="Back to partners"
      eyebrow="Add partner"
      title="Add delivery partner"
    >
      {!canManagePartners ? (
        <EmptyState
          body="Adding delivery partners requires the delivery partner management permission."
          title="Access restricted"
        />
      ) : warehousesQuery.isLoading ? (
        <LoadingState label="Loading warehouses..." />
      ) : (
        <>
          {warehousesQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
            </p>
          ) : null}
          <DeliveryPartnerEditor
            cancelHref={PARTNERS_PATH}
            canManagePay={hasPermission(ADMIN_PERMISSION.DeliveryPayoutsManage)}
            initialValues={createEmptyDeliveryPartnerForm(
              getInitialWarehouseIds(warehouseMode, warehouseOptions, requestedWarehouseId)
            )}
            partner={null}
            warehouseMode={warehouseMode}
            warehouseOptions={warehouseOptions}
          />
        </>
      )}
    </DeliveryPartnerFormShell>
  );
}

export function DeliveryPartnerEditPage({ partnerId }: { partnerId: string }) {
  const { admin, api, hasPermission } = useAdminSession();
  const isSuperAdmin = admin?.role.code === ADMIN_ROLE.SuperAdmin;
  const canManagePartners = hasPermission(ADMIN_PERMISSION.DeliveryPartnersManage);
  const warehouseMode = getDeliveryPartnerWarehouseMode(isSuperAdmin, true);
  const detailHref = `${PARTNERS_PATH}/${partnerId}`;
  // Shares the detail page key, so a saved edit is visible there immediately.
  const partnerQuery = useQuery({
    enabled: canManagePartners,
    queryFn: () =>
      api.request<AdminDeliveryPartner>(`/admin/delivery-partners/${partnerId}`),
    queryKey: ["admin", "delivery", "partner", partnerId]
  });
  // Only admins with every warehouse may change the set, so only they need the full list.
  const warehousesQuery = usePartnerWarehouseOptions(
    canManagePartners && warehouseMode === "multiple" && hasPermission(ADMIN_PERMISSION.WarehouseRead)
  );
  const partner = partnerQuery.data ?? null;

  return (
    <DeliveryPartnerFormShell
      backHref={detailHref}
      backLabel="Back to partner"
      eyebrow="Edit partner"
      title={partner ? `Edit ${partner.fullName}` : "Edit delivery partner"}
    >
      {!canManagePartners ? (
        <EmptyState
          body="Editing delivery partners requires the delivery partner management permission."
          title="Access restricted"
        />
      ) : partnerQuery.isLoading || warehousesQuery.isLoading ? (
        <LoadingState label="Loading delivery partner..." />
      ) : partnerQuery.isError || !partner ? (
        <p className="formError" role="alert">
          {getErrorMessage(partnerQuery.error) ?? "Unable to load delivery partner."}
        </p>
      ) : (
        <>
          {warehousesQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
            </p>
          ) : null}
          <DeliveryPartnerEditor
            cancelHref={detailHref}
            canManagePay={hasPermission(ADMIN_PERMISSION.DeliveryPayoutsManage)}
            initialValues={deliveryPartnerToFormValues(partner)}
            key={partner.id}
            partner={partner}
            warehouseMode={warehouseMode}
            // Keep current links visible even when one is inactive, so saving never drops it silently.
            warehouseOptions={mergeWarehouseOptions(warehousesQuery.data ?? [], partner.warehouses)}
          />
        </>
      )}
    </DeliveryPartnerFormShell>
  );
}

function DeliveryPartnerFormShell({
  backHref,
  backLabel,
  children,
  eyebrow,
  title
}: {
  backHref: string;
  backLabel: string;
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="deliveryModule deliveryPartnerFormModule">
      <section className="panel deliveryPartnerFormPanel">
        <PageHeader
          backHref={backHref}
          backLabel={backLabel}
          className="settingsSectionHeader deliverySectionHeader deliveryPartnerFormHeader"
          eyebrow={eyebrow}
          title={title}
        />
        {children}
      </section>
    </div>
  );
}

/** Active warehouses the admin may link; the API already limits staff to their own warehouses. */
function usePartnerWarehouseOptions(enabled: boolean) {
  const { api } = useAdminSession();

  return useQuery({
    enabled,
    queryFn: () =>
      loadDeliveryOptions((page) =>
        api.request<WarehouseListResponse>("/admin/warehouses", {
          query: { limit: 100, page, status: "ACTIVE" }
        })
      ),
    queryKey: ["admin", "delivery", "warehouses", "partner-form"]
  });
}

function getInitialWarehouseIds(
  mode: DeliveryPartnerWarehouseMode,
  options: WarehouseOption[],
  requestedWarehouseId: string
) {
  if (requestedWarehouseId && options.some((option) => option.id === requestedWarehouseId)) {
    return [requestedWarehouseId];
  }

  // Staff with a single warehouse have no choice to make.
  return mode === "single" && options.length === 1 ? [options[0]!.id] : [];
}

function mergeWarehouseOptions(options: WarehouseOption[], linked: WarehouseOption[]) {
  const known = new Set(options.map((option) => option.id));

  return [...options, ...linked.filter((warehouse) => !known.has(warehouse.id))];
}

function DeliveryPartnerEditor({
  cancelHref,
  canManagePay,
  initialValues,
  partner,
  warehouseMode,
  warehouseOptions
}: {
  cancelHref: string;
  canManagePay: boolean;
  initialValues: DeliveryPartnerFormValues;
  partner: AdminDeliveryPartner | null;
  warehouseMode: DeliveryPartnerWarehouseMode;
  warehouseOptions: WarehouseOption[];
}) {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<DeliveryPartnerFieldErrors>({});
  const isEditing = Boolean(partner);
  const formOptions: DeliveryPartnerFormOptions = {
    canManagePay,
    isEditing,
    warehouseMode,
    warehouseOptionCount: warehouseOptions.length
  };
  const saveMutation = useMutation({
    mutationFn: (payload: DeliveryPartnerPayload) =>
      partner
        ? api.request<AdminDeliveryPartner>(`/admin/delivery-partners/${partner.id}`, {
            body: JSON.stringify(payload),
            method: "PATCH"
          })
        : api.request<AdminDeliveryPartner>("/admin/delivery-partners", {
            body: JSON.stringify(payload),
            method: "POST"
          })
  });

  function updateValue<TKey extends keyof DeliveryPartnerFormValues>(
    key: TKey,
    value: DeliveryPartnerFormValues[TKey]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updatePaymentType(paymentType: "" | DeliveryPartnerPaymentType) {
    setValues((current) => ({
      ...current,
      // Commission most often uses a percentage of the order, so it is the starting choice.
      commissionType:
        paymentType === "COMMISSION" && !current.commissionType ? "PERCENTAGE" : current.commissionType,
      paymentType
    }));
  }

  async function savePartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saveMutation.isPending) {
      return;
    }

    const fieldErrors = validateDeliveryPartnerForm(values, formOptions);
    setErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    try {
      const savedPartner = await saveMutation.mutateAsync(
        buildDeliveryPartnerPayload(values, formOptions)
      );

      queryClient.setQueryData(["admin", "delivery", "partner", savedPartner.id], savedPartner);
      await queryClient.invalidateQueries({ queryKey: ["admin", "delivery"] });
      notify.success(isEditing ? "Delivery partner updated." : "Delivery partner added.");
      router.push(`${PARTNERS_PATH}/${savedPartner.id}`);
    } catch {
      // The API message stays on the form so the admin can correct and retry.
    }
  }

  return (
    <form className="formStack deliveryPartnerForm" noValidate onSubmit={savePartner}>
      <fieldset
        className="deliveryPartnerFormFieldset m-0 min-w-0 border-0 p-0"
        disabled={saveMutation.isPending}
      >
        {saveMutation.error ? (
          <p className="formError" role="alert">
            {saveMutation.error.message}
          </p>
        ) : null}

        <section aria-label="Partner details" className="deliveryFormSection">
          <h2>Partner details</h2>
          <div className="formGrid deliveryPartnerFormGrid">
            <DeliveryTextField
              autoComplete="name"
              error={errors.fullName}
              label="Full name"
              maxLength={DELIVERY_PARTNER_NAME_MAX_LENGTH}
              onChange={(value) => updateValue("fullName", value)}
              value={values.fullName}
            />
            <DeliveryTextField
              autoComplete="tel"
              error={errors.mobileNumber}
              hint="Include the country code, for example +919876543210."
              label="Mobile number"
              onChange={(value) => updateValue("mobileNumber", value)}
              placeholder="+919876543210"
              type="tel"
              value={values.mobileNumber}
            />
            <DeliveryTextField
              autoComplete="email"
              error={errors.email}
              label="Email (optional)"
              onChange={(value) => updateValue("email", value)}
              type="email"
              value={values.email}
            />
            <DeliveryTextField
              error={errors.vehicleNumber}
              label="Vehicle number (optional)"
              maxLength={DELIVERY_PARTNER_VEHICLE_MAX_LENGTH}
              onChange={(value) => updateValue("vehicleNumber", value)}
              placeholder="MH12AB1234"
              value={values.vehicleNumber}
            />
          </div>
        </section>

        <PartnerWarehouseSection
          error={errors.warehouseIds}
          linkedWarehouses={partner?.warehouses ?? []}
          mode={warehouseMode}
          onChange={(warehouseIds) => updateValue("warehouseIds", warehouseIds)}
          options={warehouseOptions}
          selectedIds={values.warehouseIds}
        />

        {canManagePay ? (
          <PartnerPayFields
            allowUnset={!partner?.payment.paymentType}
            errors={errors}
            onChange={updateValue}
            onPaymentTypeChange={updatePaymentType}
            values={values}
          />
        ) : partner ? (
          <section aria-label="Pay" className="deliveryFormSection">
            <h2>Pay</h2>
            <p className="deliveryReadOnlyValue">{formatDeliveryPartnerPay(partner.payment)}</p>
            <p className="deliveryFormHint">
              Only admins who manage delivery pay can change a partner&apos;s salary or commission.
            </p>
          </section>
        ) : null}

        <div className="actionRow deliveryPartnerFormActions">
          <Button className="iconTextButton" disabled={saveMutation.isPending} type="submit">
            {isEditing ? <CheckCircle2 aria-hidden size={16} /> : <UserPlus aria-hidden size={16} />}
            <span>
              {saveMutation.isPending ? "Saving..." : isEditing ? "Save changes" : "Add partner"}
            </span>
          </Button>
          <Button asChild className="iconTextButton" variant="outline">
            <Link href={cancelHref}>
              <X aria-hidden size={16} />
              <span>Cancel</span>
            </Link>
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function PartnerWarehouseSection({
  error,
  linkedWarehouses,
  mode,
  onChange,
  options,
  selectedIds
}: {
  error?: string;
  linkedWarehouses: WarehouseOption[];
  mode: DeliveryPartnerWarehouseMode;
  onChange: (warehouseIds: string[]) => void;
  options: WarehouseOption[];
  selectedIds: string[];
}) {
  const errorId = useId();

  function toggleWarehouse(warehouseId: string, checked: boolean) {
    onChange(
      checked
        ? [...selectedIds.filter((id) => id !== warehouseId), warehouseId]
        : selectedIds.filter((id) => id !== warehouseId)
    );
  }

  return (
    <section aria-label="Warehouses" className="deliveryFormSection">
      <h2>Warehouses</h2>
      {mode === "multiple" ? (
        <>
          <p className="deliveryFormHint">
            Choose every warehouse this partner picks up orders from. Orders can be dispatched only
            to partners assigned to their pickup warehouse.
          </p>
          {options.length === 0 ? (
            <EmptyState
              body="Create or activate a warehouse before assigning delivery partners to it."
              title="No active warehouses"
            />
          ) : (
            <div
              aria-describedby={error ? errorId : undefined}
              aria-label="Partner warehouses"
              className="deliveryWarehouseChoices"
              role="group"
            >
              {options.map((warehouse) => (
                <Label className="checkField deliveryWarehouseChoice" key={warehouse.id}>
                  <Checkbox
                    aria-label={formatDeliveryWarehouseName(warehouse)}
                    checked={selectedIds.includes(warehouse.id)}
                    onCheckedChange={(checked) => toggleWarehouse(warehouse.id, checked === true)}
                  />
                  <span>
                    <strong>{formatDeliveryWarehouseName(warehouse)}</strong>
                    <em>
                      {warehouse.city}, {warehouse.state}
                    </em>
                  </span>
                </Label>
              ))}
            </div>
          )}
        </>
      ) : null}

      {mode === "single" ? (
        options.length > 1 ? (
          <>
            <div className="deliveryField deliveryWarehouseSelect">
              <span aria-hidden="true">Warehouse</span>
              <Select
                aria-label="Warehouse"
                onValueChange={(value) => onChange(value ? [value] : [])}
                value={selectedIds[0] ?? ""}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {formatDeliveryWarehouseName(warehouse)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="deliveryFormHint">
              Choose one of your warehouses. Only admins can link a partner to more warehouses.
            </p>
          </>
        ) : options.length === 1 ? (
          <>
            <DeliveryWarehouseList warehouses={options} />
            <p className="deliveryFormHint">New partners are added to your warehouse.</p>
          </>
        ) : (
          <p className="deliveryFormHint">This partner will be added to your assigned warehouse.</p>
        )
      ) : null}

      {mode === "locked" ? (
        <>
          <DeliveryWarehouseList warehouses={linkedWarehouses} />
          <p className="deliveryFormHint">
            Only admins with access to every warehouse can change a partner&apos;s warehouses.
          </p>
        </>
      ) : null}

      {error ? (
        <p className="fieldError" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function DeliveryWarehouseList({ warehouses }: { warehouses: WarehouseOption[] }) {
  if (warehouses.length === 0) {
    return <p className="deliveryReadOnlyValue">No warehouses assigned.</p>;
  }

  return (
    <ul aria-label="Assigned warehouses" className="deliveryWarehouseList">
      {warehouses.map((warehouse) => (
        <li key={warehouse.id}>
          <strong>{formatDeliveryWarehouseName(warehouse)}</strong>
          <em>
            {warehouse.city}, {warehouse.state}
          </em>
        </li>
      ))}
    </ul>
  );
}

function PartnerPayFields({
  allowUnset,
  errors,
  onChange,
  onPaymentTypeChange,
  values
}: {
  allowUnset: boolean;
  errors: DeliveryPartnerFieldErrors;
  onChange: <TKey extends keyof DeliveryPartnerFormValues>(
    key: TKey,
    value: DeliveryPartnerFormValues[TKey]
  ) => void;
  onPaymentTypeChange: (paymentType: "" | DeliveryPartnerPaymentType) => void;
  values: DeliveryPartnerFormValues;
}) {
  const isPercentage = values.commissionType === "PERCENTAGE";

  return (
    <section aria-label="Pay" className="deliveryFormSection">
      <h2>Pay</h2>
      <div className="formGrid deliveryPartnerFormGrid">
        <div className="deliveryField">
          <span aria-hidden="true">Pay type</span>
          <Select
            aria-label="Pay type"
            onValueChange={(value) => onPaymentTypeChange(value as "" | DeliveryPartnerPaymentType)}
            value={values.paymentType}
          >
            <SelectTrigger>
              <SelectValue placeholder="Not set yet" />
            </SelectTrigger>
            <SelectContent>
              {allowUnset ? <SelectItem value="">Not set yet</SelectItem> : null}
              <SelectItem value="SALARY">Salary</SelectItem>
              <SelectItem value="COMMISSION">Commission per delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {values.paymentType === "SALARY" ? (
          <DeliveryTextField
            error={errors.monthlySalary}
            label="Monthly salary (₹)"
            min={0.01}
            onChange={(value) => onChange("monthlySalary", value)}
            placeholder="18000"
            step={0.01}
            type="number"
            value={values.monthlySalary}
          />
        ) : null}
        {values.paymentType === "COMMISSION" ? (
          <>
            <div className="deliveryField">
              <span aria-hidden="true">Commission type</span>
              <Select
                aria-label="Commission type"
                onValueChange={(value) => onChange("commissionType", value as "" | DeliveryCommissionType)}
                value={values.commissionType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select commission type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentage of order value</SelectItem>
                  <SelectItem value="FIXED">Fixed amount per delivery</SelectItem>
                </SelectContent>
              </Select>
              {errors.commissionType ? (
                <span className="fieldError">{errors.commissionType}</span>
              ) : null}
            </div>
            <DeliveryTextField
              error={errors.commissionValue}
              label={isPercentage ? "Commission (%)" : "Amount per delivery (₹)"}
              max={isPercentage ? 100 : undefined}
              min={0.01}
              onChange={(value) => onChange("commissionValue", value)}
              placeholder={isPercentage ? "5" : "50"}
              step={0.01}
              type="number"
              value={values.commissionValue}
            />
          </>
        ) : null}
      </div>
      <p className="deliveryFormHint">
        {values.paymentType === "COMMISSION"
          ? "Commission is credited to the partner's wallet automatically when a delivery is marked delivered."
          : values.paymentType === "SALARY"
            ? "Credit the salary each month from the partner's earnings panel."
            : "Choose salary or commission now, or set pay later from the partner profile."}
      </p>
    </section>
  );
}

export function DeliveryTextField({
  autoComplete,
  error,
  hint,
  label,
  max,
  maxLength,
  min,
  onChange,
  placeholder,
  step,
  type = "text",
  value
}: {
  autoComplete?: string;
  error?: string;
  hint?: string;
  label: string;
  max?: number;
  maxLength?: number;
  min?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: number;
  type?: string;
  value: string;
}) {
  const errorId = useId();
  const hintId = useId();
  const showHint = Boolean(hint) && !error;
  const describedBy = error ? errorId : showHint ? hintId : undefined;

  return (
    <label className="deliveryField">
      <span>{label}</span>
      <Input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        aria-label={label}
        autoComplete={autoComplete}
        max={max}
        maxLength={maxLength}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step={step}
        type={type}
        value={value}
      />
      {showHint ? (
        <span className="deliveryFieldHint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="fieldError" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
