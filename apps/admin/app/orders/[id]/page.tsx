"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CheckCircle2, FileText, RefreshCw, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "../../admin-shell";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  PermissionGate,
  ProtectedRoute,
  useAdminSession
} from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import type { WarehouseListResponse } from "../../../lib/warehouse-management";
import {
  buildAssignDeliveryPayload,
  buildCancelOrderPayload,
  buildOrderStatusPayload,
  canAssignDelivery,
  canCancelOrder,
  formatCurrency,
  formatDateTime,
  formatOrderLabel,
  getNextOrderStatuses,
  type AdminOrder,
  type AssignDeliveryValues,
  type OrderAddress,
  type OrderStatus
} from "../../../lib/order-management";

type ListResponse<T> = {
  items: T[];
};

type DeliveryPartner = {
  fullName: string;
  id: string;
  mobileNumber: string;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
  vehicleNumber: string | null;
};

export default function OrderDetailPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.OrdersRead}>
        <OrderDetailContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function OrderDetailContent() {
  const params = useParams<{ id: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [cancelReason, setCancelReason] = useState("");
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignValues, setAssignValues] = useState<AssignDeliveryValues>({
    deliveryPartnerId: "",
    note: "",
    orderId: orderId ?? "",
    pickupWarehouseId: ""
  });

  const orderQuery = useQuery({
    enabled: Boolean(orderId),
    queryFn: () => api.request<AdminOrder>(`/admin/orders/${orderId}`),
    queryKey: ["admin", "orders", orderId]
  });
  const canReadDelivery = hasPermission(ADMIN_PERMISSION.DeliveryRead);
  const partnersQuery = useQuery({
    enabled: canReadDelivery,
    queryFn: () =>
      api.request<ListResponse<DeliveryPartner>>("/admin/delivery-partners", {
        query: {
          limit: 100,
          status: "ACTIVE"
        }
      }),
    queryKey: ["admin", "orders", orderId, "delivery-partners"]
  });
  const warehousesQuery = useQuery({
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: {
          limit: 100
        }
      }),
    queryKey: ["admin", "orders", orderId, "warehouses"]
  });

  const order = orderQuery.data ?? null;
  const nextStatuses = useMemo(
    () => (order ? getNextOrderStatuses(order.status) : []),
    [order]
  );
  const activePartners = partnersQuery.data?.items ?? [];
  const warehouses = warehousesQuery.data?.items ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ note, status }: { note: string; status: OrderStatus }) =>
      api.request<AdminOrder>(`/admin/orders/${orderId}/status`, {
        body: JSON.stringify(buildOrderStatusPayload(status, note)),
        method: "PATCH"
      })
  });
  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      api.request<AdminOrder>(`/admin/orders/${orderId}/cancel`, {
        body: JSON.stringify(buildCancelOrderPayload(reason)),
        method: "POST"
      })
  });
  const assignMutation = useMutation({
    mutationFn: (values: AssignDeliveryValues) =>
      api.request("/admin/delivery/assign", {
        body: JSON.stringify(buildAssignDeliveryPayload(values)),
        method: "POST"
      })
  });

  const mutationError =
    getErrorMessage(statusMutation.error) ??
    getErrorMessage(cancelMutation.error) ??
    getErrorMessage(assignMutation.error);
  const isMutating =
    statusMutation.isPending || cancelMutation.isPending || assignMutation.isPending;

  useEffect(() => {
    setNextStatus(nextStatuses[0] ?? "");
  }, [nextStatuses]);

  useEffect(() => {
    if (orderId) {
      setAssignValues((current) => ({
        ...current,
        orderId
      }));
    }
  }, [orderId]);

  async function refreshOrder() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  }

  function requestStatusUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nextStatus || !order) {
      return;
    }

    setConfirmation({
      body: `Move ${order.orderNumber} from ${formatOrderLabel(order.status)} to ${formatOrderLabel(nextStatus)}?`,
      confirmLabel: "Update status",
      onConfirm: async () => {
        await statusMutation.mutateAsync({
          note: statusNote,
          status: nextStatus
        });
        setStatusNote("");
        setMessage("Order status updated.");
        await refreshOrder();
      },
      title: "Confirm order status"
    });
  }

  function requestCancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order) {
      return;
    }

    setConfirmation({
      body: `Cancel ${order.orderNumber}? Reserved inventory will be released when the backend accepts the cancellation.`,
      confirmLabel: "Cancel order",
      onConfirm: async () => {
        await cancelMutation.mutateAsync(cancelReason);
        setCancelReason("");
        setMessage("Order cancelled.");
        await refreshOrder();
      },
      title: "Confirm cancellation"
    });
  }

  function requestDeliveryAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order || !canAssignDelivery(order.status)) {
      return;
    }

    const partner = activePartners.find(
      (item) => item.id === assignValues.deliveryPartnerId
    );

    if (!partner) {
      setAssignmentError("Select a delivery partner before assigning delivery.");
      return;
    }

    setAssignmentError(null);
    setConfirmation({
      body: `Assign ${order.orderNumber} to ${partner.fullName}?`,
      confirmLabel: "Assign delivery",
      onConfirm: async () => {
        await assignMutation.mutateAsync(assignValues);
        setAssignValues({
          deliveryPartnerId: "",
          note: "",
          orderId: order.id,
          pickupWarehouseId: ""
        });
        setMessage("Delivery partner assigned.");
        await refreshOrder();
      },
      title: "Confirm delivery assignment"
    });
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <PageHeader
            actions={
              <div className="actionRow">
                <Button asChild className="iconTextButton" variant="outline">
                  <Link href="/orders">
                    <ArrowLeft aria-hidden size={16} />
                    <span>Back</span>
                  </Link>
                </Button>
                <Button
                  className="iconTextButton"
                  onClick={() => void orderQuery.refetch()}
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden size={16} />
                  <span>Refresh</span>
                </Button>
              </div>
            }
            eyebrow="Order detail"
            summary="Customer, fulfillment, payment, invoice, and timeline details for this order."
            title={order?.orderNumber ?? "Loading order"}
          />

          {message ? <p className="formSuccess">{message}</p> : null}
          {mutationError ? (
            <p className="formError" role="alert">
              {mutationError}
            </p>
          ) : null}
          {orderQuery.isLoading ? <LoadingState label="Loading order..." /> : null}
          {orderQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(orderQuery.error) ?? "Unable to load order."}
            </p>
          ) : null}

          {order ? (
            <div className="metricGrid resourceMetrics">
              <MetricCard
                label="Status"
                tone="primary"
                value={formatOrderLabel(order.status)}
              />
              <MetricCard
                label="Payment"
                value={formatOrderLabel(order.paymentStatus)}
              />
              <MetricCard
                label="Warehouse"
                tone="warning"
                value={order.warehouse?.code ?? order.warehouseId ?? "Unassigned"}
              />
              <MetricCard
                label="Total"
                tone="primary"
                value={formatCurrency(order.totals.grandTotal)}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {order ? (
        <>
          <div className="orderDetailGrid my-3">
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Customer</p>
                  <h2>Customer info</h2>
                </div>
              </div>
              <div className="detailGrid">
                <DetailItem
                  label="Name"
                  value={`${order.customer.firstName} ${order.customer.lastName ?? ""}`}
                />
                <DetailItem label="Mobile" value={order.customer.mobileNumber} />
                <DetailItem label="Email" value={order.customer.email ?? "-"} />
                <DetailItem
                  label="Business"
                  value={order.customer.businessName ?? "-"}
                />
                <DetailItem label="GSTIN" value={order.customer.gstNumber ?? "-"} />
                <DetailItem label="Customer ID" value={order.customer.id} />
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Delivery</p>
                  <h2>Delivery address</h2>
                </div>
              </div>
              <AddressDetail
                address={order.shippingAddress}
                emptyLabel="No delivery address on this order."
              />
            </section>
          </div>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Items</p>
                <h2>Order items</h2>
              </div>
            </div>
            <OrderItemsTable order={order} />
          </section>

          <div className="orderDetailGrid my-3">
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Warehouse</p>
                  <h2>Linked warehouse</h2>
                </div>
              </div>
              {order.warehouse ? (
                <div className="detailGrid">
                  <DetailItem label="Name" value={order.warehouse.name} />
                  <DetailItem label="Code" value={order.warehouse.code} />
                  <DetailItem label="Warehouse ID" value={order.warehouse.id} wide />
                </div>
              ) : (
                <div className="emptyPanel smallEmpty">No warehouse is linked yet.</div>
              )}
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Totals</p>
                  <h2>Order totals</h2>
                </div>
              </div>
              <div className="detailGrid">
                <DetailItem
                  label="Subtotal"
                  value={formatCurrency(order.totals.subtotal)}
                />
                <DetailItem label="Tax" value={formatCurrency(order.totals.tax)} />
                <DetailItem
                  label="Discount"
                  value={formatCurrency(order.totals.discount)}
                />
                <DetailItem
                  label="Delivery"
                  value={formatCurrency(order.totals.deliveryCharge)}
                />
                <DetailItem
                  label="Grand total"
                  value={formatCurrency(order.totals.grandTotal)}
                  wide
                />
              </div>
            </section>
          </div>

          <div className="orderDetailGrid">
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Payments</p>
                  <h2>Payment details</h2>
                </div>
              </div>
              <PaymentDetails order={order} />
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Invoice</p>
                  <h2>Invoice details</h2>
                </div>
                {order.invoice ? (
                  <FileText aria-hidden color="var(--primary)" size={22} />
                ) : null}
              </div>
              <InvoiceDetails order={order} />
            </section>
          </div>

          <section className="panel my-3">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Timeline</p>
                <h2>Order status timeline</h2>
              </div>
            </div>
            <OrderTimeline order={order} />
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Actions</p>
                <h2>Operational actions</h2>
              </div>
            </div>
            <div className="orderActionsGrid">
              <PermissionGate permission={ADMIN_PERMISSION.OrdersUpdate}>
                <form className="formStack compactForm" onSubmit={requestStatusUpdate}>
                  <h3>Update status</h3>
                  {nextStatuses.length > 0 ? (
                    <>
                      <label>
                        Next status
                        <Select
                          aria-label="Next status"
                          onValueChange={(value) => setNextStatus(value as OrderStatus)}
                          value={nextStatus}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {nextStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {formatOrderLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label>
                        Note
                        <Textarea
                          onChange={(event) => setStatusNote(event.target.value)}
                          value={statusNote}
                        />
                      </label>
                      <Button
                        className="iconTextButton"
                        disabled={isMutating}
                        type="submit"
                      >
                        <CheckCircle2 aria-hidden size={16} />
                        <span>
                          {statusMutation.isPending ? "Updating..." : "Update status"}
                        </span>
                      </Button>
                    </>
                  ) : (
                    <EmptyState
                      body="No further status transition is available."
                      title="No next status"
                    />
                  )}
                </form>
              </PermissionGate>

              <PermissionGate permission={ADMIN_PERMISSION.OrdersCancel}>
                <form className="formStack compactForm" onSubmit={requestCancel}>
                  <h3>Cancel order</h3>
                  {canCancelOrder(order.status) ? (
                    <>
                      <label>
                        Reason
                        <Textarea
                          onChange={(event) => setCancelReason(event.target.value)}
                          value={cancelReason}
                        />
                      </label>
                      <Button
                        className="iconTextButton"
                        disabled={isMutating}
                        type="submit"
                        variant="destructive"
                      >
                        <Ban aria-hidden size={16} />
                        <span>
                          {cancelMutation.isPending ? "Cancelling..." : "Cancel order"}
                        </span>
                      </Button>
                    </>
                  ) : (
                    <EmptyState
                      body="This order cannot be cancelled in its current status."
                      title="Cancellation unavailable"
                    />
                  )}
                </form>
              </PermissionGate>

              <PermissionGate permission={ADMIN_PERMISSION.DeliveryAssign}>
                <form
                  className="formStack compactForm"
                  onSubmit={requestDeliveryAssignment}
                >
                  <h3>Assign delivery</h3>
                  {canAssignDelivery(order.status) ? (
                    <>
                      {!canReadDelivery ? (
                        <p className="formError" role="alert">
                          Delivery partner lookup requires delivery read permission.
                        </p>
                      ) : null}
                      {partnersQuery.isLoading ? (
                        <LoadingState label="Loading delivery partners..." />
                      ) : null}
                      {partnersQuery.isError ? (
                        <p className="formError" role="alert">
                          {getErrorMessage(partnersQuery.error) ??
                            "Unable to load delivery partners."}
                        </p>
                      ) : null}
                      <label>
                        Delivery partner
                        <Select
                          aria-label="Delivery partner"
                          disabled={!canReadDelivery || partnersQuery.isLoading}
                          onValueChange={(value) => {
                            setAssignmentError(null);
                            setAssignValues({
                              ...assignValues,
                              deliveryPartnerId: value
                            });
                          }}
                          value={assignValues.deliveryPartnerId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select partner" />
                          </SelectTrigger>
                          <SelectContent>
                            {activePartners.map((partner) => (
                              <SelectItem key={partner.id} value={partner.id}>
                                {partner.fullName} ({partner.mobileNumber})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      {assignmentError ? (
                        <p className="formError" role="alert">
                          {assignmentError}
                        </p>
                      ) : null}
                      <label>
                        Pickup warehouse
                        <Select
                          aria-label="Pickup warehouse"
                          disabled={warehousesQuery.isLoading}
                          onValueChange={(value) =>
                            setAssignValues({
                              ...assignValues,
                              pickupWarehouseId: value
                            })
                          }
                          value={assignValues.pickupWarehouseId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Use order warehouse" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Use order warehouse</SelectItem>
                            {warehouses.map((warehouse) => (
                              <SelectItem key={warehouse.id} value={warehouse.id}>
                                {warehouse.name} ({warehouse.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label>
                        Note
                        <Textarea
                          onChange={(event) =>
                            setAssignValues({
                              ...assignValues,
                              note: event.target.value
                            })
                          }
                          value={assignValues.note}
                        />
                      </label>
                      <Button
                        className="iconTextButton"
                        disabled={
                          isMutating ||
                          !canReadDelivery ||
                          partnersQuery.isLoading ||
                          partnersQuery.isError ||
                          !assignValues.deliveryPartnerId
                        }
                        type="submit"
                        variant="secondary"
                      >
                        <Truck aria-hidden size={16} />
                        <span>
                          {assignMutation.isPending
                            ? "Assigning..."
                            : "Assign delivery"}
                        </span>
                      </Button>
                    </>
                  ) : (
                    <EmptyState
                      body="Delivery assignment is available only for confirmed or packed orders."
                      title="Assignment unavailable"
                    />
                  )}
                </form>
              </PermissionGate>
            </div>
          </section>
        </>
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

function AddressDetail({
  address,
  emptyLabel
}: {
  address: OrderAddress | null;
  emptyLabel: string;
}) {
  if (!address) {
    return <div className="emptyPanel smallEmpty">{emptyLabel}</div>;
  }

  return (
    <div className="detailGrid">
      <DetailItem label="Name" value={address.fullName} />
      <DetailItem label="Mobile" value={address.mobileNumber} />
      <DetailItem label="Line 1" value={address.line1} wide />
      <DetailItem label="Line 2" value={address.line2 ?? "-"} wide />
      <DetailItem label="City" value={address.city} />
      <DetailItem label="State" value={address.state} />
      <DetailItem label="Pincode" value={address.pincode} />
      <DetailItem label="Country" value={address.country} />
    </div>
  );
}

function OrderItemsTable({ order }: { order: AdminOrder }) {
  if (order.items.length === 0) {
    return <EmptyState body="No order items found." title="No items found" />;
  }

  return (
    <div className="resourceTable orderItemsTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Tax</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Warehouse</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <strong>{item.name}</strong>
                <em>{item.productId ?? "Custom quote line"}</em>
              </TableCell>
              <TableCell>{item.sku}</TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
              <TableCell>
                {formatCurrency(item.taxAmount)} ({item.taxRate}%)
              </TableCell>
              <TableCell>{formatCurrency(item.total)}</TableCell>
              <TableCell>{item.warehouseId ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PaymentDetails({ order }: { order: AdminOrder }) {
  if (order.paymentDetails.length === 0 && order.refunds.length === 0) {
    return <div className="emptyPanel smallEmpty">No payment attempts recorded.</div>;
  }

  return (
    <div className="detailGrid">
      {order.paymentDetails.map((payment) => (
        <div className="detailItem" data-wide="true" key={payment.id}>
          <span>{formatOrderLabel(payment.method)} payment</span>
          <strong>{formatCurrency(payment.amount)}</strong>
          <small>
            {formatOrderLabel(payment.status)} · {payment.provider ?? "No provider"} ·{" "}
            {payment.transactionRef ?? payment.providerPaymentId ?? payment.id}
          </small>
        </div>
      ))}
      {order.refunds.map((refund) => (
        <div className="detailItem" data-wide="true" key={refund.id}>
          <span>Refund {formatOrderLabel(refund.status)}</span>
          <strong>{formatCurrency(refund.amount)}</strong>
          <small>
            {refund.providerRefundId ?? refund.id} /{" "}
            {refund.processedAt
              ? `Processed ${formatDateTime(refund.processedAt)}`
              : "Not processed yet"}
          </small>
          {refund.reason ? <small>{refund.reason}</small> : null}
        </div>
      ))}
    </div>
  );
}

function InvoiceDetails({ order }: { order: AdminOrder }) {
  if (!order.invoice) {
    return (
      <div className="emptyPanel smallEmpty">No invoice has been generated yet.</div>
    );
  }

  return (
    <div className="detailGrid">
      <DetailItem label="Invoice number" value={order.invoice.invoiceNumber} />
      <DetailItem label="Issued" value={formatDateTime(order.invoice.issuedAt)} />
      <DetailItem label="PDF status" value={order.invoice.pdfStatus} />
      <DetailItem label="Tax type" value={order.invoice.taxBreakup.taxType} />
      <DetailItem
        label="Subtotal"
        value={formatCurrency(order.invoice.totals.subtotal)}
      />
      <DetailItem
        label="Discount"
        value={formatCurrency(order.invoice.totals.discount)}
      />
      <DetailItem
        label="Delivery"
        value={formatCurrency(order.invoice.totals.deliveryCharge)}
      />
      <DetailItem label="Tax" value={formatCurrency(order.invoice.totals.tax)} />
      <DetailItem
        label="Grand total"
        value={formatCurrency(order.invoice.totals.grandTotal)}
        wide
      />
    </div>
  );
}

function OrderTimeline({ order }: { order: AdminOrder }) {
  if (order.statusHistory.length === 0) {
    return <div className="emptyPanel smallEmpty">No status events recorded.</div>;
  }

  return (
    <ol className="orderTimeline">
      {order.statusHistory.map((entry) => (
        <li key={entry.id}>
          <strong>{formatOrderLabel(entry.status)}</strong>
          <span>{formatDateTime(entry.createdAt)}</span>
          {entry.note ? <p>{entry.note}</p> : null}
          {entry.changedById ? <em>Changed by {entry.changedById}</em> : null}
        </li>
      ))}
    </ol>
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
