"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  PackageCheck,
  RefreshCw,
  RotateCw,
  SlidersHorizontal,
  X
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterDrawer } from "@/components/admin/filter-drawer";
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
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "../../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import type { WarehouseListResponse } from "../../../lib/warehouse-management";
import {
  RETURN_STOCK_DISPOSITIONS,
  buildReturnDispositionPayload,
  createEmptyReturnDispositionFormValues,
  returnDispositionFormSchema,
  type ReturnDispositionFormValues
} from "../../../lib/inventory-management";
import {
  REFUND_STATUSES,
  buildReturnActionPayload,
  buildReturnRequestQuery,
  canApproveReturn,
  canProcessReturnRefund,
  canRejectReturn,
  createEmptyReturnRequestFilters,
  formatCurrency,
  formatDateTime,
  formatOrderLabel,
  getLatestRefund,
  type AdminOrder,
  type PaginatedResponse,
  type ReturnRequestFilters
} from "../../../lib/order-management";
import "../returns-refunds-responsive.css";

const PAGE_SIZE = 20;

export function ReturnsRefundsRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.OrdersRead}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function ReturnRequestQueuePage() {
  return <ReturnsRefundsContent />;
}

function ReturnsRefundsContent() {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const canUpdateOrders = hasPermission(ADMIN_PERMISSION.OrdersUpdate);
  const canUpdateInventory = hasPermission(ADMIN_PERMISSION.InventoryUpdate);
  const canReadWarehouses = hasPermission(ADMIN_PERMISSION.WarehouseRead);
  const [draftFilters, setDraftFilters] = useState<ReturnRequestFilters>(
    createEmptyReturnRequestFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<ReturnRequestFilters>(
    createEmptyReturnRequestFilters()
  );
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [dispositionErrors, setDispositionErrors] = useState<Record<string, string>>(
    {}
  );
  const [dispositionForms, setDispositionForms] = useState<
    Record<string, ReturnDispositionFormValues>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const returnQuery = useMemo(
    () => buildReturnRequestQuery(appliedFilters, page, PAGE_SIZE),
    [appliedFilters, page]
  );

  const returnsQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedResponse<AdminOrder>>("/admin/returns-refunds", {
        query: returnQuery
      }),
    queryKey: ["admin", "returns-refunds", returnQuery]
  });
  const warehousesQuery = useQuery({
    enabled: canReadWarehouses,
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: {
          limit: 100
        }
      }),
    queryKey: ["admin", "returns-refunds", "warehouses"]
  });
  const approveMutation = useMutation({
    mutationFn: ({ note, orderId }: { note: string; orderId: string }) =>
      api.request<AdminOrder>(`/admin/returns-refunds/${orderId}/approve`, {
        body: JSON.stringify(buildReturnActionPayload(note)),
        method: "POST"
      })
  });
  const rejectMutation = useMutation({
    mutationFn: ({ note, orderId }: { note: string; orderId: string }) =>
      api.request<AdminOrder>(`/admin/returns-refunds/${orderId}/reject`, {
        body: JSON.stringify(buildReturnActionPayload(note)),
        method: "POST"
      })
  });
  const processMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.request<AdminOrder>(`/admin/returns-refunds/${orderId}/process`, {
        method: "POST"
      })
  });
  const dispositionMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildReturnDispositionPayload>) =>
      api.request("/admin/inventory/return-disposition", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });

  const returnRequests = returnsQuery.data?.items ?? [];
  const warehouses: Pick<
    WarehouseListResponse["items"][number],
    "code" | "id" | "name"
  >[] = canReadWarehouses
    ? [...(warehousesQuery.data?.items ?? [])]
    : [
        ...new Map(
          returnRequests.flatMap((order) =>
            order.warehouse
              ? [[order.warehouse.id, order.warehouse] as const]
              : []
          )
        ).values()
      ];
  if (
    appliedFilters.warehouseId &&
    !warehouses.some((warehouse) => warehouse.id === appliedFilters.warehouseId)
  ) {
    warehouses.push({
      code: "",
      id: appliedFilters.warehouseId,
      name: "Selected warehouse"
    });
  }
  const pagination = returnsQuery.data?.pagination;
  const latestRefunds = returnRequests
    .map((order) => getLatestRefund(order))
    .filter(Boolean);
  const activeVisibleCount = latestRefunds.filter((refund) =>
    refund ? ["PENDING", "PROCESSING"].includes(refund.status) : false
  ).length;
  const completedVisibleCount = latestRefunds.filter(
    (refund) => refund?.status === "COMPLETED"
  ).length;
  const failedVisibleCount = latestRefunds.filter(
    (refund) => refund?.status === "FAILED"
  ).length;
  const error =
    getErrorMessage(returnsQuery.error) ??
    getErrorMessage(warehousesQuery.error) ??
    getErrorMessage(approveMutation.error) ??
    getErrorMessage(rejectMutation.error) ??
    getErrorMessage(processMutation.error) ??
    getErrorMessage(dispositionMutation.error);
  const isActionPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    processMutation.isPending;
  const isDispositionPending = dispositionMutation.isPending;

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
  }

  function resetFilters() {
    const emptyFilters = createEmptyReturnRequestFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  async function refreshReturnRequests() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "returns-refunds"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    ]);
  }

  async function refreshAfterDisposition() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "returns-refunds"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] })
    ]);
  }

  function updateActionNote(orderId: string, note: string) {
    setActionNotes((current) => ({
      ...current,
      [orderId]: note
    }));
  }

  function clearActionNote(orderId: string) {
    setActionNotes((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
  }

  function clearDispositionError(orderId: string) {
    setDispositionErrors((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
  }

  function updateDispositionForm(
    order: AdminOrder,
    values: ReturnDispositionFormValues
  ) {
    setDispositionForms((current) => ({
      ...current,
      [order.id]: values
    }));
    clearDispositionError(order.id);
  }

  function clearDispositionForm(orderId: string) {
    setDispositionForms((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
    clearDispositionError(orderId);
  }

  async function approveReturn(order: AdminOrder) {
    setMessage(null);
    await approveMutation.mutateAsync({
      note: actionNotes[order.id] ?? "",
      orderId: order.id
    });
    clearActionNote(order.id);
    setMessage(`${order.orderNumber} return approved.`);
    await refreshReturnRequests();
  }

  async function rejectReturn(order: AdminOrder) {
    setMessage(null);
    await rejectMutation.mutateAsync({
      note: actionNotes[order.id] ?? "",
      orderId: order.id
    });
    clearActionNote(order.id);
    setMessage(`${order.orderNumber} return rejected.`);
    await refreshReturnRequests();
  }

  async function processReturnRefund(order: AdminOrder) {
    setMessage(null);
    await processMutation.mutateAsync(order.id);
    setMessage(`${order.orderNumber} refund status refreshed.`);
    await refreshReturnRequests();
  }

  async function recordStockDisposition(
    order: AdminOrder,
    values: ReturnDispositionFormValues
  ) {
    setMessage(null);
    const parsed = returnDispositionFormSchema.safeParse(values);

    if (!parsed.success) {
      setDispositionErrors((current) => ({
        ...current,
        [order.id]:
          parsed.error.issues[0]?.message ?? "Check the stock disposition form."
      }));
      return;
    }

    const selectedItem = order.items.find(
      (item) => item.id === parsed.data.orderItemId
    );

    if (!selectedItem) {
      setDispositionErrors((current) => ({
        ...current,
        [order.id]: "Choose a returned order item."
      }));
      return;
    }

    if (!selectedItem.warehouseId) {
      setDispositionErrors((current) => ({
        ...current,
        [order.id]: "This order item is not linked to a warehouse."
      }));
      return;
    }

    if (Number(parsed.data.quantity) > selectedItem.quantity) {
      setDispositionErrors((current) => ({
        ...current,
        [order.id]: `Quantity cannot exceed ${selectedItem.quantity}.`
      }));
      return;
    }

    if (parsed.data.disposition === "RESTOCK" && !selectedItem.stockBatchId) {
      setDispositionErrors((current) => ({
        ...current,
        [order.id]: "Restock requires the original stock batch."
      }));
      return;
    }

    await dispositionMutation.mutateAsync(buildReturnDispositionPayload(parsed.data));
    clearDispositionForm(order.id);
    setMessage(`${order.orderNumber} stock disposition recorded.`);
    await refreshAfterDisposition();
  }

  return (
    <div className="returnsRefundsModule">
      <section className="panel returnsRefundsOverviewPanel">
        <PageHeader
          actions={
            <div className="actionRow returnsRefundsHeaderActions">
              <Button
                className="iconTextButton"
                onClick={() => setIsFilterDrawerOpen(true)}
                type="button"
              >
                <SlidersHorizontal aria-hidden size={16} />
                <span>Add filter</span>
              </Button>
              <Button
                className="iconTextButton"
                onClick={() => void refreshReturnRequests()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="returnsRefundsPageHeader"
          eyebrow="Returns & refunds"
          summary="Review customer return requests with payment, refund, warehouse, and customer context."
          title="Return request queue"
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics returnsRefundsMetricGrid">
          <MetricCard label="Total matches" tone="primary" value={pagination?.total ?? 0} />
          <MetricCard label="Visible" value={returnRequests.length} />
          <MetricCard label="Active visible" tone="warning" value={activeVisibleCount} />
          <MetricCard label="Completed visible" tone="primary" value={completedVisibleCount} />
          <MetricCard label="Failed visible" tone="warning" value={failedVisibleCount} />
        </div>
      </section>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        isSubmitting={returnsQuery.isFetching}
        onApply={applyFilters}
        onOpenChange={setIsFilterDrawerOpen}
        onReset={resetFilters}
        summary="Filter by refund status, customer mobile, order number, or warehouse."
        title="Return request filters"
      >
        <ReturnRequestFilterFields
          filters={draftFilters}
          isWarehouseLoading={warehousesQuery.isLoading}
          onChange={setDraftFilters}
          warehouses={warehouses}
        />
      </FilterDrawer>

      <section className="panel returnsRefundsRequestsPanel mt-3">
        <PageHeader
          className="settingsSectionHeader"
          eyebrow="Return table"
          level={2}
          summary="Filter return requests, then approve, reject, process/refetch refunds, or record stock disposition."
          title="Refund workflow"
        />
        {returnsQuery.isLoading ? <LoadingState label="Loading return requests..." /> : null}
        {!returnsQuery.isLoading && !returnsQuery.isError ? (
          <ReturnRequestsTable
            actionNotes={actionNotes}
            canUpdateInventory={canUpdateInventory}
            canUpdateOrders={canUpdateOrders}
            dispositionErrors={dispositionErrors}
            dispositionForms={dispositionForms}
            isActionPending={isActionPending}
            isDispositionPending={isDispositionPending}
            onApprove={(order) => void approveReturn(order)}
            onDispositionChange={updateDispositionForm}
            onDispositionSubmit={(order, values) =>
              void recordStockDisposition(order, values)
            }
            onNoteChange={updateActionNote}
            onProcess={(order) => void processReturnRefund(order)}
            onReject={(order) => void rejectReturn(order)}
            orders={returnRequests}
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
    </div>
  );
}

function ReturnRequestFilterFields({
  filters,
  isWarehouseLoading,
  onChange,
  warehouses
}: {
  filters: ReturnRequestFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: ReturnRequestFilters) => void;
  warehouses: Pick<
    WarehouseListResponse["items"][number],
    "code" | "id" | "name"
  >[];
}) {
  return (
    <div className="filterDrawerFields">
      <Select
        aria-label="Refund status"
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value as ReturnRequestFilters["status"]
          })
        }
        value={filters.status}
      >
        <SelectTrigger className="filterDrawerControl">
          <SelectValue placeholder="Any refund status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any refund status</SelectItem>
          {REFUND_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {formatOrderLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label>
        Customer mobile
        <Input
          className="filterDrawerControl"
          inputMode="tel"
          onChange={(event) =>
            onChange({ ...filters, customerMobile: event.target.value })
          }
          placeholder="9999999999"
          value={filters.customerMobile}
        />
      </label>
      <label>
        Order number
        <Input
          className="filterDrawerControl"
          onChange={(event) =>
            onChange({ ...filters, orderNumber: event.target.value.toUpperCase() })
          }
          placeholder="ORD-20260525"
          value={filters.orderNumber}
        />
      </label>
      <Select
        aria-label="Warehouse"
        disabled={isWarehouseLoading}
        onValueChange={(value) => onChange({ ...filters, warehouseId: value })}
        value={filters.warehouseId}
      >
        <SelectTrigger className="filterDrawerControl">
          <SelectValue placeholder="All visible warehouses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All visible warehouses</SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
              {warehouse.code ? ` (${warehouse.code})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ReturnRequestsTable({
  actionNotes,
  canUpdateInventory,
  canUpdateOrders,
  dispositionErrors,
  dispositionForms,
  isActionPending,
  isDispositionPending,
  onApprove,
  onDispositionChange,
  onDispositionSubmit,
  onNoteChange,
  onProcess,
  onReject,
  orders
}: {
  actionNotes: Record<string, string>;
  canUpdateInventory: boolean;
  canUpdateOrders: boolean;
  dispositionErrors: Record<string, string>;
  dispositionForms: Record<string, ReturnDispositionFormValues>;
  isActionPending: boolean;
  isDispositionPending: boolean;
  onApprove: (order: AdminOrder) => void;
  onDispositionChange: (
    order: AdminOrder,
    values: ReturnDispositionFormValues
  ) => void;
  onDispositionSubmit: (
    order: AdminOrder,
    values: ReturnDispositionFormValues
  ) => void;
  onNoteChange: (orderId: string, note: string) => void;
  onProcess: (order: AdminOrder) => void;
  onReject: (order: AdminOrder) => void;
  orders: AdminOrder[];
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        body="No return requests match the selected filters."
        title="No returns found"
      />
    );
  }

  return (
    <div className="returnsRefundsTableShell">
      <p className="returnsRefundsTableHint">
        Swipe sideways to view every return and refund option.
      </p>
      <div className="resourceTable returnsRefundsTable">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Refund</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Stock disposition</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const refund = getLatestRefund(order);
            const payment = order.paymentDetails[0] ?? null;
            const note = actionNotes[order.id] ?? "";
            const dispositionItems = getDispositionableOrderItems(order);
            const dispositionValues =
              dispositionForms[order.id] ??
              createEmptyReturnDispositionFormValues(
                order.id,
                dispositionItems[0]?.id ?? ""
              );

            return (
              <TableRow key={order.id}>
                <TableCell>
                  <strong>{order.orderNumber}</strong>
                  <em>{formatDateTime(order.placedAt ?? order.createdAt)}</em>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>
                  <strong>{getCustomerName(order)}</strong>
                  <em>{order.customer.mobileNumber}</em>
                  {order.customer.businessName ? (
                    <em>{order.customer.businessName}</em>
                  ) : null}
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.paymentStatus} />
                  <em>{payment ? formatCurrency(payment.amount) : "No payment row"}</em>
                  {payment?.providerPaymentId ? (
                    <em>{payment.providerPaymentId}</em>
                  ) : null}
                </TableCell>
                <TableCell>
                  {refund ? (
                    <>
                      <StatusBadge status={refund.status} />
                      <strong>{formatCurrency(refund.amount)}</strong>
                      <em>Requested {formatDateTime(refund.createdAt)}</em>
                      {refund.processedAt ? (
                        <em>Processed {formatDateTime(refund.processedAt)}</em>
                      ) : null}
                      {refund.providerRefundId ? (
                        <em>{refund.providerRefundId}</em>
                      ) : null}
                    </>
                  ) : (
                    "No refund"
                  )}
                </TableCell>
                <TableCell>{refund?.reason ?? "-"}</TableCell>
                <TableCell>{order.warehouse?.name ?? order.warehouseId ?? "Unassigned"}</TableCell>
                <TableCell>
                  {canUpdateInventory ? (
                    <ReturnDispositionInlineForm
                      error={dispositionErrors[order.id]}
                      isPending={isDispositionPending}
                      items={dispositionItems}
                      onChange={(values) => onDispositionChange(order, values)}
                      onSubmit={(values) => onDispositionSubmit(order, values)}
                      order={order}
                      values={dispositionValues}
                    />
                  ) : (
                    <em>Inventory permission required</em>
                  )}
                </TableCell>
                <TableCell>
                  <div className="tableActions verticalActions returnsRefundsActionGroup">
                    <Button asChild className="iconTextButton" size="sm" variant="outline">
                      <Link href={`/orders/${order.id}`}>
                        <Eye aria-hidden size={16} />
                        <span>View</span>
                      </Link>
                    </Button>
                    {canUpdateOrders ? (
                      <>
                        <Textarea
                          aria-label={`Return note for ${order.orderNumber}`}
                          onChange={(event) =>
                            onNoteChange(order.id, event.target.value)
                          }
                          placeholder="Internal note"
                          value={note}
                        />
                        <Button
                          className="iconTextButton"
                          disabled={!canApproveReturn(order) || isActionPending}
                          onClick={() => onApprove(order)}
                          size="sm"
                          type="button"
                        >
                          <CheckCircle2 aria-hidden size={16} />
                          <span>Approve</span>
                        </Button>
                        <Button
                          className="iconTextButton"
                          disabled={!canRejectReturn(order) || isActionPending}
                          onClick={() => onReject(order)}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          <X aria-hidden size={16} />
                          <span>Reject</span>
                        </Button>
                        <Button
                          className="iconTextButton"
                          disabled={!canProcessReturnRefund(order) || isActionPending}
                          onClick={() => onProcess(order)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <RotateCw aria-hidden size={16} />
                          <span>Process/refetch</span>
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ReturnDispositionInlineForm({
  error,
  isPending,
  items,
  onChange,
  onSubmit,
  order,
  values
}: {
  error?: string;
  isPending: boolean;
  items: AdminOrder["items"];
  onChange: (values: ReturnDispositionFormValues) => void;
  onSubmit: (values: ReturnDispositionFormValues) => void;
  order: AdminOrder;
  values: ReturnDispositionFormValues;
}) {
  const isEnabled = order.status === "RETURNED";
  const selectedItem = items.find((item) => item.id === values.orderItemId);
  const maxQuantity = selectedItem?.quantity ?? 1;

  if (!isEnabled) {
    return <em>Approve return first</em>;
  }

  if (items.length === 0) {
    return <em>No warehouse-linked items</em>;
  }

  return (
    <form
      className="tableActions verticalActions returnsRefundsDispositionForm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <Select
        aria-label={`Returned item for ${order.orderNumber}`}
        disabled={isPending}
        onValueChange={(value) =>
          onChange({
            ...values,
            orderItemId: value
          })
        }
        value={values.orderItemId}
      >
        <SelectTrigger>
          <SelectValue placeholder="Returned item" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {formatOrderItemLabel(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        aria-label={`Disposition quantity for ${order.orderNumber}`}
        inputMode="numeric"
        max={maxQuantity}
        min={1}
        onChange={(event) =>
          onChange({
            ...values,
            quantity: event.target.value
          })
        }
        type="number"
        value={values.quantity}
      />
      <Select
        aria-label={`Disposition for ${order.orderNumber}`}
        disabled={isPending}
        onValueChange={(value) =>
          onChange({
            ...values,
            disposition: value as ReturnDispositionFormValues["disposition"]
          })
        }
        value={values.disposition}
      >
        <SelectTrigger>
          <SelectValue placeholder="Disposition" />
        </SelectTrigger>
        <SelectContent>
          {RETURN_STOCK_DISPOSITIONS.map((disposition) => (
            <SelectItem key={disposition} value={disposition}>
              {formatOrderLabel(disposition)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        aria-label={`Disposition note for ${order.orderNumber}`}
        onChange={(event) =>
          onChange({
            ...values,
            note: event.target.value
          })
        }
        placeholder="Inspection note"
        value={values.note}
      />
      {error ? (
        <p className="formError" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="iconTextButton"
        disabled={isPending}
        size="sm"
        type="submit"
        variant="outline"
      >
        <PackageCheck aria-hidden size={16} />
        <span>Record stock</span>
      </Button>
    </form>
  );
}

function getCustomerName(order: AdminOrder) {
  return `${order.customer.firstName} ${order.customer.lastName ?? ""}`.trim();
}

function getDispositionableOrderItems(order: AdminOrder) {
  return order.items.filter((item) => item.quantity > 0 && item.warehouseId);
}

function formatOrderItemLabel(item: AdminOrder["items"][number]) {
  const sku = item.sku ? ` (${item.sku})` : "";

  return `${item.name}${sku} x ${item.quantity}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
