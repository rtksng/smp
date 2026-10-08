"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { Button } from "@/components/ui/button";
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
import { useAdminSession } from "../../../lib/admin-session";
import {
  buildDeliveryLedgerPayload,
  createDeliveryLedgerForm,
  DELIVERY_LEDGER_DESCRIPTION_MAX_LENGTH,
  DELIVERY_LEDGER_REFERENCE_MAX_LENGTH,
  formatDeliveryDateTime,
  formatDeliveryLedgerAmount,
  formatDeliveryLedgerEntryType,
  formatDeliveryLedgerFormType,
  formatSalaryPeriod,
  getDefaultDeliveryLedgerDescription,
  getDeliveryLedgerEntryTypes,
  validateDeliveryLedgerForm,
  type AdminDeliveryPartner,
  type DeliveryLedgerEntry,
  type DeliveryLedgerEntryType,
  type DeliveryLedgerFieldErrors,
  type DeliveryLedgerFormValues,
  type DeliveryLedgerPayload,
  type DeliveryPartnerEarnings,
  type DeliveryPartnerPayment
} from "../../../lib/delivery-management";
import { formatCurrency } from "../../../lib/order-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import { useClientPagination } from "../../../lib/use-client-pagination";
import { useTableOverflow } from "../../../lib/use-table-overflow";
import { DeliveryTextField } from "./delivery-partner-form";

export function DeliveryPartnerEarningsPanel({ partner }: { partner: AdminDeliveryPartner }) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const canManagePay = hasPermission(ADMIN_PERMISSION.DeliveryPayoutsManage);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Nested under the partner key, so refreshing the partner also refreshes its earnings.
  const earningsQuery = useQuery({
    queryFn: () =>
      api.request<DeliveryPartnerEarnings>(`/admin/delivery-partners/${partner.id}/earnings`),
    queryKey: ["admin", "delivery", "partner", partner.id, "earnings"]
  });
  const ledgerMutation = useMutation({
    mutationFn: (payload: DeliveryLedgerPayload) =>
      api.request<DeliveryLedgerEntry>(`/admin/delivery-partners/${partner.id}/ledger`, {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });
  const earnings = earningsQuery.data ?? null;
  const wallet = earnings?.wallet ?? partner.wallet;
  const payment = earnings?.payment ?? partner.payment;

  function totalValue(select: (totals: DeliveryPartnerEarnings["totals"]) => ReactNode) {
    if (earnings) {
      return select(earnings.totals);
    }

    return earningsQuery.isError ? "-" : "...";
  }

  function requestLedgerEntry(payload: DeliveryLedgerPayload, onRecorded: () => void) {
    const label = formatDeliveryLedgerFormType(payload.type);
    const period = payload.salaryPeriod ? ` for ${formatSalaryPeriod(payload.salaryPeriod)}` : "";

    setMessage(null);
    setConfirmation({
      body: `Record a ${label.toLowerCase()} of ${formatCurrency(payload.amount)}${period} for ${partner.fullName}?`,
      confirmLabel: "Record payment",
      onConfirm: async () => {
        await ledgerMutation.mutateAsync(payload);
        onRecorded();
        setMessage(`${label} recorded.`);
        await queryClient.invalidateQueries({ queryKey: ["admin", "delivery"] });
      },
      title: "Confirm payment entry"
    });
  }

  return (
    <section aria-label="Earnings and payments" className="panel deliveryEarningsPanel">
      <PageHeader
        className="settingsSectionHeader deliverySectionHeader"
        eyebrow="Earnings"
        level={2}
        title="Earnings and payments"
      />
      {message ? <p className="formSuccess">{message}</p> : null}
      {earningsQuery.isError ? (
        <p className="formError" role="alert">
          {getErrorMessage(earningsQuery.error) ?? "Unable to load partner earnings."}
        </p>
      ) : null}
      <div className="metricGrid resourceMetrics deliveryMetricGrid deliveryEarningsMetricGrid">
        <MetricCard label="Wallet balance" tone="primary" value={formatCurrency(wallet.balance)} />
        <MetricCard label="Total earned" value={formatCurrency(wallet.totalEarnings)} />
        <MetricCard
          label="Commission earned"
          value={totalValue((totals) => formatCurrency(totals.commissionEarnings))}
        />
        <MetricCard
          label="Salary credited"
          value={totalValue((totals) => formatCurrency(totals.salaryEarnings))}
        />
        <MetricCard
          label="Paid out"
          tone="warning"
          value={totalValue((totals) => formatCurrency(totals.paidOut))}
        />
        <MetricCard
          label="Completed deliveries"
          value={totalValue((totals) => totals.completedDeliveries)}
        />
      </div>
      {payment.paymentType === "COMMISSION" ? (
        <p className="deliveryFormHint">
          Commission is added to the wallet automatically when a delivery is marked delivered.
        </p>
      ) : null}

      {canManagePay ? (
        partner.status === "ACTIVE" ? (
          <LedgerEntryForm
            balance={wallet.balance}
            isPending={ledgerMutation.isPending}
            // A pay change alters which entry types apply, so the form restarts from its defaults.
            key={`${payment.paymentType ?? "unset"}-${payment.monthlySalary ?? ""}`}
            onSubmit={requestLedgerEntry}
            partnerName={partner.fullName}
            payment={payment}
          />
        ) : (
          <p className="deliveryNotice">Payments can be recorded only for active partners.</p>
        )
      ) : null}

      <div className="deliveryLedgerSection">
        <h3>Payment history</h3>
        {earningsQuery.isLoading ? <LoadingState label="Loading payment history..." /> : null}
        {earnings && earnings.entries.length === 0 ? (
          <EmptyState
            body="Commission, salary credits, and payouts for this partner appear here."
            title="No payments yet"
          />
        ) : null}
        {earnings && earnings.entries.length > 0 ? (
          <LedgerTable entries={earnings.entries} />
        ) : null}
      </div>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={ledgerMutation.isPending}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </section>
  );
}

function LedgerEntryForm({
  balance,
  isPending,
  onSubmit,
  partnerName,
  payment
}: {
  balance: number;
  isPending: boolean;
  onSubmit: (payload: DeliveryLedgerPayload, onRecorded: () => void) => void;
  partnerName: string;
  payment: DeliveryPartnerPayment;
}) {
  const entryTypes = getDeliveryLedgerEntryTypes(payment);
  const [values, setValues] = useState<DeliveryLedgerFormValues>(() =>
    createDeliveryLedgerForm("PAYOUT", payment)
  );
  const [isDescriptionEdited, setIsDescriptionEdited] = useState(false);
  const [errors, setErrors] = useState<DeliveryLedgerFieldErrors>({});

  function updateValue<TKey extends keyof DeliveryLedgerFormValues>(
    key: TKey,
    value: DeliveryLedgerFormValues[TKey]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function changeType(type: DeliveryLedgerEntryType) {
    setValues((current) => ({ ...createDeliveryLedgerForm(type, payment), reference: current.reference }));
    setIsDescriptionEdited(false);
    setErrors({});
  }

  function changeSalaryPeriod(salaryPeriod: string) {
    setValues((current) => ({
      ...current,
      // Keep the suggested description in step with the month until the admin writes their own.
      description: isDescriptionEdited
        ? current.description
        : getDefaultDeliveryLedgerDescription(current.type, salaryPeriod),
      salaryPeriod
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const fieldErrors = validateDeliveryLedgerForm(values, { balance, payment });
    setErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    const recordedType = values.type;

    onSubmit(buildDeliveryLedgerPayload(values), () => {
      setValues(createDeliveryLedgerForm(recordedType, payment));
      setIsDescriptionEdited(false);
    });
  }

  return (
    <form
      aria-label={`Record payment for ${partnerName}`}
      className="formStack deliveryLedgerForm"
      noValidate
      onSubmit={submit}
    >
      <h3>Record payment</h3>
      <div className="formGrid deliveryLedgerFormGrid">
        <div className="deliveryField">
          <span aria-hidden="true">Entry type</span>
          <Select
            aria-label="Entry type"
            onValueChange={(value) => {
              if (value) {
                changeType(value as DeliveryLedgerEntryType);
              }
            }}
            value={values.type}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select entry type" />
            </SelectTrigger>
            <SelectContent>
              {entryTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatDeliveryLedgerFormType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type ? <span className="fieldError">{errors.type}</span> : null}
        </div>
        <DeliveryTextField
          error={errors.amount}
          hint={values.type === "PAYOUT" ? `Available balance: ${formatCurrency(balance)}` : undefined}
          label="Amount (₹)"
          min={0.01}
          onChange={(value) => updateValue("amount", value)}
          step={0.01}
          type="number"
          value={values.amount}
        />
        {values.type === "SALARY" ? (
          <DeliveryTextField
            error={errors.salaryPeriod}
            label="Salary month"
            onChange={changeSalaryPeriod}
            type="month"
            value={values.salaryPeriod}
          />
        ) : null}
        <DeliveryTextField
          error={errors.description}
          label="Description"
          maxLength={DELIVERY_LEDGER_DESCRIPTION_MAX_LENGTH}
          onChange={(value) => {
            setIsDescriptionEdited(true);
            updateValue("description", value);
          }}
          value={values.description}
        />
        <DeliveryTextField
          error={errors.reference}
          label="Reference (optional)"
          maxLength={DELIVERY_LEDGER_REFERENCE_MAX_LENGTH}
          onChange={(value) => updateValue("reference", value)}
          placeholder="Bank or UPI transaction ID"
          value={values.reference}
        />
      </div>
      <Button className="iconTextButton" disabled={isPending} type="submit">
        <Wallet aria-hidden size={16} />
        <span>{isPending ? "Recording..." : "Record payment"}</span>
      </Button>
    </form>
  );
}

function LedgerTable({ entries }: { entries: DeliveryLedgerEntry[] }) {
  const ledgerPages = useClientPagination(entries);
  const { isOverflowing, shellRef } = useTableOverflow(entries.length > 0);

  return (
    <>
      <div
        className="deliveryTableShell deliveryLedgerTableShell"
        data-overflowing={isOverflowing ? "true" : undefined}
        ref={shellRef}
      >
        {isOverflowing ? (
          <p className="deliveryTableHint" id="delivery-ledger-table-hint">
            Swipe sideways to view every payment column.
          </p>
        ) : null}
        <div className="resourceTable deliveryLedgerDataTable">
          <Table aria-describedby="delivery-ledger-table-hint" aria-label="Payment history">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerPages.pageItems.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="deliveryLedgerDateCell" data-label="Date">
                    {formatDeliveryDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell className="deliveryLedgerTypeCell" data-label="Type">
                    {formatDeliveryLedgerEntryType(entry)}
                  </TableCell>
                  <TableCell className="deliveryLedgerDescriptionCell" data-label="Description">
                    <strong>{entry.description}</strong>
                    {entry.salaryPeriod ? (
                      <em>Salary month: {formatSalaryPeriod(entry.salaryPeriod)}</em>
                    ) : null}
                  </TableCell>
                  <TableCell className="deliveryLedgerReferenceCell" data-label="Reference">
                    {entry.reference ?? "-"}
                  </TableCell>
                  <TableCell
                    className="deliveryLedgerAmountCell"
                    data-direction={entry.type === "PAYOUT" ? "debit" : "credit"}
                    data-label="Amount"
                  >
                    {formatDeliveryLedgerAmount(entry)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <PaginationControls
        ariaLabel="Payment history pagination"
        onChange={ledgerPages.setPage}
        page={ledgerPages.page}
        pageSize={ledgerPages.pageSize}
        totalItems={ledgerPages.totalItems}
        totalPages={ledgerPages.totalPages}
      />
    </>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
