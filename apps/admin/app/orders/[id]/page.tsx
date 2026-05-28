"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  FileText,
  RefreshCw,
  Truck
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "../../admin-shell";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "../../_components/confirmation-dialog";
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

    setConfirmation({
      body: `Assign ${order.orderNumber} to ${partner?.fullName ?? "the selected delivery partner"}?`,
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
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Order detail</p>
            <h2>{order?.orderNumber ?? "Loading order"}</h2>
            <p className="panelSummary">
              Customer, fulfillment, payment, invoice, and timeline details for this order.
            </p>
          </div>
          <div className="actionRow">
            <Link className="ghostButton iconTextButton" href="/orders">
              <ArrowLeft aria-hidden size={16} />
              <span>Back</span>
            </Link>
            <button
              className="ghostButton iconTextButton"
              onClick={() => void orderQuery.refetch()}
              type="button"
            >
              <RefreshCw aria-hidden size={16} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}
        {orderQuery.isLoading ? <div className="loadingBlock">Loading order...</div> : null}
        {orderQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(orderQuery.error) ?? "Unable to load order."}
          </p>
        ) : null}

        {order ? (
          <div className="metricGrid resourceMetrics">
            <article className="metric metric--primary">
              <span>Status</span>
              <strong className="metricText">{formatOrderLabel(order.status)}</strong>
            </article>
            <article className="metric metric--neutral">
              <span>Payment</span>
              <strong className="metricText">{formatOrderLabel(order.paymentStatus)}</strong>
            </article>
            <article className="metric metric--warning">
              <span>Warehouse</span>
              <strong className="metricText">
                {order.warehouse?.code ?? order.warehouseId ?? "Unassigned"}
              </strong>
            </article>
            <article className="metric metric--primary">
              <span>Total</span>
              <strong className="metricText">{formatCurrency(order.totals.grandTotal)}</strong>
            </article>
          </div>
        ) : null}
      </section>

      {order ? (
        <>
          <div className="orderDetailGrid">
            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Customer</p>
                  <h2>Customer info</h2>
                </div>
              </div>
              <div className="detailGrid">
                <DetailItem label="Name" value={`${order.customer.firstName} ${order.customer.lastName ?? ""}`} />
                <DetailItem label="Mobile" value={order.customer.mobileNumber} />
                <DetailItem label="Email" value={order.customer.email ?? "-"} />
                <DetailItem label="Business" value={order.customer.businessName ?? "-"} />
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
              <AddressDetail address={order.shippingAddress} emptyLabel="No delivery address on this order." />
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

          <div className="orderDetailGrid">
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
                <DetailItem label="Subtotal" value={formatCurrency(order.totals.subtotal)} />
                <DetailItem label="Tax" value={formatCurrency(order.totals.tax)} />
                <DetailItem label="Discount" value={formatCurrency(order.totals.discount)} />
                <DetailItem label="Delivery" value={formatCurrency(order.totals.deliveryCharge)} />
                <DetailItem label="Grand total" value={formatCurrency(order.totals.grandTotal)} wide />
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
                {order.invoice ? <FileText aria-hidden color="var(--primary)" size={22} /> : null}
              </div>
              <InvoiceDetails order={order} />
            </section>
          </div>

          <section className="panel">
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
                        <select
                          onChange={(event) =>
                            setNextStatus(event.target.value as OrderStatus)
                          }
                          required
                          value={nextStatus}
                        >
                          {nextStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatOrderLabel(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Note
                        <textarea
                          onChange={(event) => setStatusNote(event.target.value)}
                          value={statusNote}
                        />
                      </label>
                      <button className="primaryButton iconTextButton" disabled={isMutating} type="submit">
                        <CheckCircle2 aria-hidden size={16} />
                        <span>{statusMutation.isPending ? "Updating..." : "Update status"}</span>
                      </button>
                    </>
                  ) : (
                    <div className="emptyPanel smallEmpty">No further status transition is available.</div>
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
                        <textarea
                          onChange={(event) => setCancelReason(event.target.value)}
                          value={cancelReason}
                        />
                      </label>
                      <button className="dangerButton iconTextButton" disabled={isMutating} type="submit">
                        <Ban aria-hidden size={16} />
                        <span>{cancelMutation.isPending ? "Cancelling..." : "Cancel order"}</span>
                      </button>
                    </>
                  ) : (
                    <div className="emptyPanel smallEmpty">This order cannot be cancelled in its current status.</div>
                  )}
                </form>
              </PermissionGate>

              <PermissionGate permission={ADMIN_PERMISSION.DeliveryAssign}>
                <form className="formStack compactForm" onSubmit={requestDeliveryAssignment}>
                  <h3>Assign delivery</h3>
                  {canAssignDelivery(order.status) ? (
                    <>
                      {!canReadDelivery ? (
                        <p className="formError" role="alert">
                          Delivery partner lookup requires delivery read permission.
                        </p>
                      ) : null}
                      {partnersQuery.isLoading ? (
                        <div className="loadingBlock">Loading delivery partners...</div>
                      ) : null}
                      {partnersQuery.isError ? (
                        <p className="formError" role="alert">
                          {getErrorMessage(partnersQuery.error) ?? "Unable to load delivery partners."}
                        </p>
                      ) : null}
                      <label>
                        Delivery partner
                        <select
                          disabled={!canReadDelivery || partnersQuery.isLoading}
                          onChange={(event) =>
                            setAssignValues({
                              ...assignValues,
                              deliveryPartnerId: event.target.value
                            })
                          }
                          required
                          value={assignValues.deliveryPartnerId}
                        >
                          <option value="">Select partner</option>
                          {activePartners.map((partner) => (
                            <option key={partner.id} value={partner.id}>
                              {partner.fullName} ({partner.mobileNumber})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Pickup warehouse
                        <select
                          disabled={warehousesQuery.isLoading}
                          onChange={(event) =>
                            setAssignValues({
                              ...assignValues,
                              pickupWarehouseId: event.target.value
                            })
                          }
                          value={assignValues.pickupWarehouseId}
                        >
                          <option value="">Use order warehouse</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name} ({warehouse.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Note
                        <textarea
                          onChange={(event) =>
                            setAssignValues({
                              ...assignValues,
                              note: event.target.value
                            })
                          }
                          value={assignValues.note}
                        />
                      </label>
                      <button
                        className="secondaryButton iconTextButton"
                        disabled={isMutating || !canReadDelivery}
                        type="submit"
                      >
                        <Truck aria-hidden size={16} />
                        <span>{assignMutation.isPending ? "Assigning..." : "Assign delivery"}</span>
                      </button>
                    </>
                  ) : (
                    <div className="emptyPanel smallEmpty">Delivery assignment is available only for confirmed or packed orders.</div>
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
    return <div className="emptyPanel smallEmpty">No order items found.</div>;
  }

  return (
    <div className="orderItemsTable" role="table">
      <div className="orderItemsTableHeader" role="row">
        <strong role="columnheader">Item</strong>
        <strong role="columnheader">SKU</strong>
        <strong role="columnheader">Qty</strong>
        <strong role="columnheader">Unit</strong>
        <strong role="columnheader">Tax</strong>
        <strong role="columnheader">Total</strong>
        <strong role="columnheader">Warehouse</strong>
      </div>
      {order.items.map((item) => (
        <div className="orderItemsTableRow" key={item.id} role="row">
          <span role="cell">
            <strong>{item.name}</strong>
            <em>{item.productId}</em>
          </span>
          <span role="cell">{item.sku}</span>
          <span role="cell">{item.quantity}</span>
          <span role="cell">{formatCurrency(item.unitPrice)}</span>
          <span role="cell">
            {formatCurrency(item.taxAmount)} ({item.taxRate}%)
          </span>
          <span role="cell">{formatCurrency(item.total)}</span>
          <span role="cell">{item.warehouseId ?? "-"}</span>
        </div>
      ))}
    </div>
  );
}

function PaymentDetails({ order }: { order: AdminOrder }) {
  if (order.paymentDetails.length === 0) {
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
    </div>
  );
}

function InvoiceDetails({ order }: { order: AdminOrder }) {
  if (!order.invoice) {
    return <div className="emptyPanel smallEmpty">No invoice has been generated yet.</div>;
  }

  return (
    <div className="detailGrid">
      <DetailItem label="Invoice number" value={order.invoice.invoiceNumber} />
      <DetailItem label="Issued" value={formatDateTime(order.invoice.issuedAt)} />
      <DetailItem label="PDF status" value={order.invoice.pdfStatus} />
      <DetailItem label="Tax type" value={order.invoice.taxBreakup.taxType} />
      <DetailItem label="Subtotal" value={formatCurrency(order.invoice.totals.subtotal)} />
      <DetailItem label="Tax" value={formatCurrency(order.invoice.totals.tax)} />
      <DetailItem label="Grand total" value={formatCurrency(order.invoice.totals.grandTotal)} wide />
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
