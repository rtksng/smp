"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquarePlus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { StatusBadge } from "@/components/admin/status-badge";
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
import {
  buildCustomerStatusPayload,
  buildCustomerSupportNotePayload,
  CUSTOMER_STATUSES,
  formatCustomerStatus,
  formatCustomerDate,
  resolveCustomerStatus,
  type AdminCustomerAddress,
  type AdminCustomerDetail,
  type AdminCustomerOrderSummary,
  type AdminCustomerSupportNote,
  type CustomerStatus
} from "../../../lib/customer-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import { useTableOverflow } from "../../../lib/use-table-overflow";
import {
  formatCurrency,
  formatDateTime,
  formatOrderLabel
} from "../../../lib/order-management";
import "../customers-responsive.css";

export default function CustomerDetailPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.UsersRead}>
        <CustomerDetailContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function CustomerDetailContent() {
  const params = useParams<{ id: string | string[] }>();
  const customerId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [nextStatus, setNextStatus] = useState<CustomerStatus>("ACTIVE");
  const [statusNote, setStatusNote] = useState("");
  const [supportNote, setSupportNote] = useState("");

  const customerQuery = useQuery({
    enabled: Boolean(customerId),
    queryFn: () => api.request<AdminCustomerDetail>(`/admin/customers/${customerId}`),
    queryKey: ["admin", "customers", customerId]
  });
  const customer = customerQuery.data ?? null;
  const customerStatus = customer ? resolveCustomerStatus(customer) : "ACTIVE";
  const statusMutation = useMutation({
    mutationFn: ({ note, status }: { note: string; status: CustomerStatus }) =>
      api.request<AdminCustomerDetail>(`/admin/customers/${customerId}/status`, {
        body: JSON.stringify(buildCustomerStatusPayload(status, note)),
        method: "PATCH"
      })
  });
  const noteMutation = useMutation({
    mutationFn: (note: string) =>
      api.request<AdminCustomerSupportNote>(`/admin/customers/${customerId}/notes`, {
        body: JSON.stringify(buildCustomerSupportNotePayload(note)),
        method: "POST"
      })
  });

  const isMutating = statusMutation.isPending || noteMutation.isPending;
  const mutationError =
    getErrorMessage(statusMutation.error) ?? getErrorMessage(noteMutation.error);

  useEffect(() => {
    if (customer) {
      setNextStatus(customerStatus);
    }
  }, [customer, customerStatus]);

  async function refreshCustomer() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "customers", customerId] })
    ]);
  }

  function requestStatusUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customer || nextStatus === customerStatus) {
      return;
    }

    setConfirmation({
      body: `Change ${customer.name} from ${formatCustomerStatus(customerStatus)} to ${formatCustomerStatus(nextStatus)}?`,
      confirmLabel: "Update status",
      onConfirm: async () => {
        await statusMutation.mutateAsync({
          note: statusNote,
          status: nextStatus
        });
        setStatusNote("");
        setMessage("Customer status updated.");
        await refreshCustomer();
      },
      title: "Confirm customer status"
    });
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supportNote.trim()) {
      return;
    }

    await noteMutation.mutateAsync(supportNote);
    setSupportNote("");
    setMessage("Support note added.");
    await refreshCustomer();
  }

  return (
    <div className="customersModule customerDetailModule">
      <Card className="customerDetailHeroPanel">
        <CardContent className="customerDetailHeroContent p-6">
          <PageHeader
            actions={
              <div className="actionRow customerDetailHeaderActions">
                <Button
                  className="iconTextButton"
                  onClick={() => void customerQuery.refetch()}
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden size={16} />
                  <span>Refresh</span>
                </Button>
              </div>
            }
            backHref="/customers"
            backLabel="Back to customers"
            eyebrow="Customer detail"
            className="customerDetailPageHeader"
            summary="Profile, address, order, and support activity for this customer."
            title={customer?.name ?? "Loading customer"}
          />

          {message ? <p className="formSuccess">{message}</p> : null}
          {mutationError ? (
            <p className="formError" role="alert">
              {mutationError}
            </p>
          ) : null}
          {customerQuery.isLoading ? (
            <LoadingState label="Loading customer..." />
          ) : null}
          {customerQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(customerQuery.error) ?? "Unable to load customer."}
            </p>
          ) : null}

          {customer ? (
            <div className="metricGrid resourceMetrics customerDetailMetricGrid">
              <MetricCard
                label="Status"
                tone={customerStatus === "ACTIVE" ? "primary" : "warning"}
                value={formatCustomerStatus(customerStatus)}
              />
              <MetricCard label="Orders" value={customer.orderCount} />
              <MetricCard label="Addresses" value={customer.addressCount} />
              <MetricCard label="GSTIN" value={customer.gstNumber ? "Available" : "Missing"} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {customer ? (
        <>
          <div className="orderDetailGrid customerProfileGrid my-3">
            <section className="panel customerDetailPanel">
              {/* Status already leads the metric cards above, so the profile header stays plain. */}
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Profile</p>
                  <h2>Customer info</h2>
                </div>
              </div>
              <div className="detailGrid">
                <DetailItem label="Name" value={customer.name} />
                <DetailItem label="Mobile" value={customer.mobileNumber} />
                <DetailItem label="Email" value={customer.email ?? "-"} />
                <DetailItem label="Business" value={customer.businessName ?? "-"} />
                <DetailItem label="GSTIN" value={customer.gstNumber ?? "-"} />
                <DetailItem label="Created" value={formatCustomerDate(customer.createdAt)} />
                <DetailItem label="Customer ID" value={customer.id} wide />
              </div>
            </section>

            <section className="panel customerDetailPanel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Actions</p>
                  <h2>Account status</h2>
                </div>
              </div>
              <PermissionGate
                fallback={
                  <EmptyState
                    body="Customer updates require users.update permission."
                    title="Update access required"
                  />
                }
                permission={ADMIN_PERMISSION.UsersUpdate}
              >
                <form className="formStack compactForm customerStatusForm" onSubmit={requestStatusUpdate}>
                  <label>
                    Status
                    <Select
                      aria-label="Customer status"
                      onValueChange={(value) => setNextStatus(value as CustomerStatus)}
                      value={nextStatus}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {formatCustomerStatus(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    Note
                    <Textarea
                      onChange={(event) => setStatusNote(event.target.value)}
                      placeholder="Reason visible to admins only"
                      value={statusNote}
                    />
                  </label>
                  <Button
                    className="iconTextButton"
                    disabled={isMutating || nextStatus === customerStatus}
                    type="submit"
                  >
                    <CheckCircle2 aria-hidden size={16} />
                    <span>{statusMutation.isPending ? "Updating..." : "Update status"}</span>
                  </Button>
                </form>
              </PermissionGate>
            </section>
          </div>

          <section className="panel customerDetailPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Addresses</p>
                <h2>Saved addresses</h2>
              </div>
            </div>
            <AddressGrid addresses={customer.addresses} />
          </section>

          <section className="panel customerDetailPanel my-3">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Orders</p>
                <h2>Order history</h2>
              </div>
            </div>
            <CustomerOrdersTable orders={customer.orders} />
          </section>

          <section className="panel customerDetailPanel">
            <div className="panelHeader">
              <div>
                <p className="eyebrow">Support</p>
                <h2>Internal notes</h2>
              </div>
            </div>
            <div className="orderDetailGrid customerSupportGrid">
              <PermissionGate
                fallback={
                  <EmptyState
                    body="Support notes require users.update permission."
                    title="Note access required"
                  />
                }
                permission={ADMIN_PERMISSION.UsersUpdate}
              >
                <form className="formStack compactForm customerSupportForm" onSubmit={addNote}>
                  <label>
                    New note
                    <Textarea
                      onChange={(event) => setSupportNote(event.target.value)}
                      placeholder="Add a support note"
                      value={supportNote}
                    />
                  </label>
                  <Button
                    className="iconTextButton"
                    disabled={isMutating || !supportNote.trim()}
                    type="submit"
                    variant="secondary"
                  >
                    <MessageSquarePlus aria-hidden size={16} />
                    <span>{noteMutation.isPending ? "Saving..." : "Add note"}</span>
                  </Button>
                </form>
              </PermissionGate>
              <SupportNotes notes={customer.supportNotes} />
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
    </div>
  );
}

function AddressGrid({ addresses }: { addresses: AdminCustomerAddress[] }) {
  if (addresses.length === 0) {
    return <EmptyState body="No saved addresses found." title="No addresses" />;
  }

  return (
    <div className="customerAddressGrid">
      {addresses.map((address) => (
        <div className="detailItem" data-wide="true" key={address.id}>
          <span>
            {formatOrderLabel(address.type)}
            {address.isDefault ? " / Default" : ""}
          </span>
          <strong>{address.fullName}</strong>
          <small>{address.mobileNumber}</small>
          <small>
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
          </small>
          <small>
            {address.city}, {address.state} {address.pincode}
          </small>
        </div>
      ))}
    </div>
  );
}

function CustomerOrdersTable({
  orders
}: {
  orders: AdminCustomerOrderSummary[];
}) {
  const { isOverflowing, shellRef } = useTableOverflow(orders.length > 0);

  if (orders.length === 0) {
    return <EmptyState body="No orders found for this customer." title="No orders" />;
  }

  return (
    <div
      className="customerOrderTableShell"
      data-overflowing={isOverflowing ? "true" : undefined}
      ref={shellRef}
    >
      {isOverflowing ? (
        <p className="customerTableHint" id="customer-orders-table-hint">
          Swipe sideways to view every order option.
        </p>
      ) : null}
      <div className="resourceTable ordersTable customerOrdersTable">
        <Table aria-describedby="customer-orders-table-hint" aria-label="Order history">
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Placed</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="customerOrderCell">
                <strong>{order.orderNumber}</strong>
                <em title={order.id}>{order.id}</em>
              </TableCell>
              <TableCell className="customerOrderStatusCell">
                <StatusBadge status={order.status} />
              </TableCell>
              <TableCell className="customerOrderPaymentCell" data-label="Payment">
                <StatusBadge status={order.paymentStatus} />
              </TableCell>
              <TableCell className="customerOrderTotalCell" data-label="Total">
                {formatCurrency(order.grandTotal)}
              </TableCell>
              <TableCell className="customerOrderPlacedCell" data-label="Placed">
                {formatDateTime(order.placedAt ?? order.createdAt)}
              </TableCell>
              <TableCell className="customerOrderActionCell">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/orders/${order.id}`}>Open</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SupportNotes({ notes }: { notes: AdminCustomerSupportNote[] }) {
  if (notes.length === 0) {
    return <div className="emptyPanel smallEmpty">No support notes yet.</div>;
  }

  return (
    <ol className="orderTimeline">
      {notes.map((note) => (
        <li key={note.id}>
          <strong>{note.adminName ?? "Admin note"}</strong>
          <span>{formatDateTime(note.createdAt)}</span>
          <p>{note.note}</p>
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
