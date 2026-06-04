"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  Truck,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "../admin-shell";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "../_components/confirmation-dialog";
import {
  PermissionGate,
  ProtectedRoute,
  useAdminSession
} from "../../lib/admin-session";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import {
  PaginationControls as SharedPaginationControls
} from "@/components/admin/pagination-controls";
import { StatusBadge as AdminStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  buildAssignDeliveryPayload,
  canAssignDelivery,
  formatCurrency,
  type AdminOrder,
  type AssignDeliveryValues,
  type PaginatedResponse as OrderPaginatedResponse
} from "../../lib/order-management";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import type { WarehouseListResponse } from "../../lib/warehouse-management";
import {
  DELIVERY_ASSIGNMENT_STATUSES,
  DELIVERY_PARTNER_STATUSES,
  buildDeliveryAssignmentQuery,
  buildDeliveryPartnerQuery,
  createEmptyDeliveryAssignmentFilters,
  createEmptyDeliveryPartnerFilters,
  formatDeliveryDateTime,
  formatDeliveryLabel,
  type AdminDeliveryAssignment,
  type AdminDeliveryPartner,
  type DeliveryAssignmentFilters,
  type DeliveryPartnerFilters,
  type PaginatedResponse
} from "../../lib/delivery-management";

const DELIVERY_PAGE_SIZE = 20;
const emptyAssignmentForm: AssignDeliveryValues = {
  deliveryPartnerId: "",
  note: "",
  orderId: "",
  pickupWarehouseId: ""
};

export default function DeliveryPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.DeliveryRead}>
        <DeliveryContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function DeliveryContent() {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [partnerPage, setPartnerPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partnerDraftFilters, setPartnerDraftFilters] =
    useState<DeliveryPartnerFilters>(createEmptyDeliveryPartnerFilters());
  const [partnerFilters, setPartnerFilters] = useState<DeliveryPartnerFilters>(
    createEmptyDeliveryPartnerFilters()
  );
  const [assignmentDraftFilters, setAssignmentDraftFilters] =
    useState<DeliveryAssignmentFilters>(createEmptyDeliveryAssignmentFilters());
  const [assignmentFilters, setAssignmentFilters] =
    useState<DeliveryAssignmentFilters>(createEmptyDeliveryAssignmentFilters());
  const [assignmentForm, setAssignmentForm] =
    useState<AssignDeliveryValues>(emptyAssignmentForm);

  const partnerQuery = useMemo(
    () => buildDeliveryPartnerQuery(partnerFilters, partnerPage, DELIVERY_PAGE_SIZE),
    [partnerFilters, partnerPage]
  );
  const assignmentQuery = useMemo(
    () =>
      buildDeliveryAssignmentQuery(
        assignmentFilters,
        assignmentPage,
        DELIVERY_PAGE_SIZE
      ),
    [assignmentFilters, assignmentPage]
  );

  const partnersQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedResponse<AdminDeliveryPartner>>(
        "/admin/delivery-partners",
        {
          query: partnerQuery
        }
      ),
    queryKey: ["admin", "delivery", "partners", partnerQuery]
  });
  const partnerDetailQuery = useQuery({
    enabled: Boolean(selectedPartnerId),
    queryFn: () =>
      api.request<AdminDeliveryPartner>(
        `/admin/delivery-partners/${selectedPartnerId}`
      ),
    queryKey: ["admin", "delivery", "partner", selectedPartnerId]
  });
  const assignmentsQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedResponse<AdminDeliveryAssignment>>(
        "/admin/delivery/assignments",
        {
          query: assignmentQuery
        }
      ),
    queryKey: ["admin", "delivery", "assignments", assignmentQuery]
  });
  const ordersQuery = useQuery({
    enabled: hasPermission(ADMIN_PERMISSION.OrdersRead),
    queryFn: () =>
      api.request<OrderPaginatedResponse<AdminOrder>>("/admin/orders", {
        query: {
          limit: 100
        }
      }),
    queryKey: ["admin", "delivery", "orders"]
  });
  const warehousesQuery = useQuery({
    enabled: hasPermission(ADMIN_PERMISSION.WarehouseRead),
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: {
          limit: 100
        }
      }),
    queryKey: ["admin", "delivery", "warehouses"]
  });

  const partners = useMemo(
    () => partnersQuery.data?.items ?? [],
    [partnersQuery.data?.items]
  );
  const assignments = useMemo(
    () => assignmentsQuery.data?.items ?? [],
    [assignmentsQuery.data?.items]
  );
  const warehouses = useMemo(
    () => warehousesQuery.data?.items ?? [],
    [warehousesQuery.data?.items]
  );
  const orders = useMemo(() => ordersQuery.data?.items ?? [], [ordersQuery.data?.items]);
  const activePartners = useMemo(
    () => partners.filter((partner) => partner.status === "ACTIVE"),
    [partners]
  );
  const assignableOrders = useMemo(
    () => orders.filter((order) => canAssignDelivery(order.status)),
    [orders]
  );
  const selectedPartner =
    partnerDetailQuery.data ??
    partners.find((partner) => partner.id === selectedPartnerId) ??
    null;

  const approveMutation = useMutation({
    mutationFn: (partnerId: string) =>
      api.request<AdminDeliveryPartner>(
        `/admin/delivery-partners/${partnerId}/approve`,
        {
          method: "PATCH"
        }
      )
  });
  const rejectMutation = useMutation({
    mutationFn: (partnerId: string) =>
      api.request<AdminDeliveryPartner>(
        `/admin/delivery-partners/${partnerId}/reject`,
        {
          method: "PATCH"
        }
      )
  });
  const assignMutation = useMutation({
    mutationFn: (values: AssignDeliveryValues) =>
      api.request<AdminDeliveryAssignment>("/admin/delivery/assign", {
        body: JSON.stringify(buildAssignDeliveryPayload(values)),
        method: "POST"
      })
  });
  const isMutating =
    approveMutation.isPending || rejectMutation.isPending || assignMutation.isPending;
  const mutationError =
    getErrorMessage(approveMutation.error) ??
    getErrorMessage(rejectMutation.error) ??
    getErrorMessage(assignMutation.error);

  useEffect(() => {
    const firstPartner = partners[0];

    if (!firstPartner) {
      setSelectedPartnerId(null);
      return;
    }

    if (!selectedPartnerId || !partners.some((partner) => partner.id === selectedPartnerId)) {
      setSelectedPartnerId(firstPartner.id);
    }
  }, [partners, selectedPartnerId]);

  async function refreshDeliveryData() {
    await Promise.all([
      partnersQuery.refetch(),
      assignmentsQuery.refetch(),
      partnerDetailQuery.refetch()
    ]);
  }

  async function invalidateDeliveryData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "delivery"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
    ]);
  }

  function applyPartnerFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPartnerPage(1);
    setPartnerFilters(partnerDraftFilters);
  }

  function resetPartnerFilters() {
    const emptyFilters = createEmptyDeliveryPartnerFilters();
    setPartnerPage(1);
    setPartnerDraftFilters(emptyFilters);
    setPartnerFilters(emptyFilters);
  }

  function applyAssignmentFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssignmentPage(1);
    setAssignmentFilters(assignmentDraftFilters);
  }

  function resetAssignmentFilters() {
    const emptyFilters = createEmptyDeliveryAssignmentFilters();
    setAssignmentPage(1);
    setAssignmentDraftFilters(emptyFilters);
    setAssignmentFilters(emptyFilters);
  }

  function requestPartnerAction(
    action: "approve" | "reject",
    partner: AdminDeliveryPartner
  ) {
    const isApprove = action === "approve";

    setConfirmation({
      body: `${isApprove ? "Approve" : "Reject"} ${partner.fullName} as a delivery partner?`,
      confirmLabel: isApprove ? "Approve partner" : "Reject partner",
      onConfirm: async () => {
        if (isApprove) {
          await approveMutation.mutateAsync(partner.id);
          setMessage("Delivery partner approved.");
        } else {
          await rejectMutation.mutateAsync(partner.id);
          setMessage("Delivery partner rejected.");
        }
        await invalidateDeliveryData();
      },
      title: isApprove ? "Confirm approval" : "Confirm rejection"
    });
  }

  function requestAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const order = assignableOrders.find((item) => item.id === assignmentForm.orderId);
    const partner = activePartners.find(
      (item) => item.id === assignmentForm.deliveryPartnerId
    );

    if (!order || !partner) {
      setAssignmentError("Select an order and active delivery partner before assigning delivery.");
      return;
    }

    setAssignmentError(null);
    setConfirmation({
      body: `Assign ${order.orderNumber} to ${partner.fullName}?`,
      confirmLabel: "Assign delivery",
      onConfirm: async () => {
        await assignMutation.mutateAsync(assignmentForm);
        setAssignmentForm(emptyAssignmentForm);
        setMessage("Delivery assignment created.");
        await invalidateDeliveryData();
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
              <Button
                className="iconTextButton"
                onClick={() => void refreshDeliveryData()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            }
            eyebrow="Delivery operations"
            summary="Approve delivery partners, review documents, assign orders, and track assignment progress from the admin panel."
            title="Admin delivery management"
          />

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <MetricCard label="Partners" tone="primary" value={partnersQuery.data?.pagination?.total ?? partners.length} />
          <MetricCard label="Active visible" value={partners.filter((partner) => partner.status === "ACTIVE").length} />
          <MetricCard
            label="Pending visible"
            tone="warning"
            value={partners.filter((partner) => partner.status === "PENDING_VERIFICATION").length}
          />
          <MetricCard label="Online visible" tone="primary" value={partners.filter((partner) => partner.isOnline).length} />
        </div>
        </CardContent>
      </Card>

      <section className="panel">
        <PageHeader eyebrow="Partners" level={2} title="Delivery partner approvals" />
        <PartnerFilterForm
          filters={partnerDraftFilters}
          onChange={setPartnerDraftFilters}
          onReset={resetPartnerFilters}
          onSubmit={applyPartnerFilters}
        />
        <div className="deliveryManagementGrid">
          <div>
            {partnersQuery.isLoading ? (
              <LoadingState label="Loading delivery partners..." />
            ) : null}
            {partnersQuery.isError ? (
              <p className="formError" role="alert">
                {getErrorMessage(partnersQuery.error) ??
                  "Unable to load delivery partners."}
              </p>
            ) : null}
            {!partnersQuery.isLoading && !partnersQuery.isError ? (
              <PartnerList
                isMutating={isMutating}
                onAction={requestPartnerAction}
                onSelect={setSelectedPartnerId}
                partners={partners}
                selectedPartnerId={selectedPartnerId}
              />
            ) : null}
            {partnersQuery.data?.pagination ? (
              <SharedPaginationControls
                onChange={setPartnerPage}
                page={partnersQuery.data.pagination.page}
                totalPages={Math.max(partnersQuery.data.pagination.totalPages, 1)}
              />
            ) : null}
          </div>
          <PartnerDetail
            isLoading={partnerDetailQuery.isLoading}
            partner={selectedPartner}
            queryError={partnerDetailQuery.error}
          />
        </div>
      </section>

      <section className="panel">
        <PageHeader eyebrow="Assignments" level={2} title="Delivery assignments table" />
        <AssignmentFilterForm
          filters={assignmentDraftFilters}
          isWarehouseLoading={warehousesQuery.isLoading}
          onChange={setAssignmentDraftFilters}
          onReset={resetAssignmentFilters}
          onSubmit={applyAssignmentFilters}
          partners={partners}
          warehouses={warehouses}
        />
        {warehousesQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
          </p>
        ) : null}
        {assignmentsQuery.isLoading ? (
          <LoadingState label="Loading delivery assignments..." />
        ) : null}
        {assignmentsQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(assignmentsQuery.error) ??
              "Unable to load delivery assignments."}
          </p>
        ) : null}
        {!assignmentsQuery.isLoading && !assignmentsQuery.isError ? (
          <AssignmentsTable assignments={assignments} />
        ) : null}
        {assignmentsQuery.data?.pagination ? (
          <SharedPaginationControls
            onChange={setAssignmentPage}
            page={assignmentsQuery.data.pagination.page}
            totalPages={Math.max(assignmentsQuery.data.pagination.totalPages, 1)}
          />
        ) : null}
      </section>

      <PermissionGate permission={ADMIN_PERMISSION.DeliveryAssign}>
        <section className="panel">
          <PageHeader eyebrow="Assignment" level={2} title="Assign order to delivery partner" />
          {!hasPermission(ADMIN_PERMISSION.OrdersRead) ? (
            <p className="formError" role="alert">
              Order lookup requires orders read permission.
            </p>
          ) : null}
          {!hasPermission(ADMIN_PERMISSION.WarehouseRead) ? (
            <p className="formError" role="alert">
              Warehouse lookup requires warehouse read permission.
            </p>
          ) : null}
          {ordersQuery.isLoading ? (
            <LoadingState label="Loading assignable orders..." />
          ) : null}
          {ordersQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(ordersQuery.error) ?? "Unable to load orders."}
            </p>
          ) : null}
          <AssignmentForm
            activePartners={activePartners}
            assignableOrders={assignableOrders}
            isPending={assignMutation.isPending}
            error={assignmentError}
            onChange={setAssignmentForm}
            onValidationReset={() => setAssignmentError(null)}
            onSubmit={requestAssignment}
            showEmptyStates={
              !ordersQuery.isLoading &&
              !ordersQuery.isError &&
              !partnersQuery.isLoading &&
              !partnersQuery.isError
            }
            values={assignmentForm}
            warehouses={warehouses}
          />
        </section>
      </PermissionGate>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isMutating}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function PartnerFilterForm({
  filters,
  onChange,
  onReset,
  onSubmit
}: {
  filters: DeliveryPartnerFilters;
  onChange: (filters: DeliveryPartnerFilters) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="deliveryFilters" onSubmit={onSubmit}>
      <Select
        aria-label="Partner status"
        onValueChange={(value) =>
          onChange({
            status: value as DeliveryPartnerFilters["status"]
          })
        }
        value={filters.status}
      >
        <SelectTrigger>
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any status</SelectItem>
          {DELIVERY_PARTNER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {formatDeliveryLabel(status)}
            </SelectItem>
          ))}
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

function AssignmentFilterForm({
  filters,
  isWarehouseLoading,
  onChange,
  onReset,
  onSubmit,
  partners,
  warehouses
}: {
  filters: DeliveryAssignmentFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: DeliveryAssignmentFilters) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  partners: AdminDeliveryPartner[];
  warehouses: WarehouseListResponse["items"];
}) {
  return (
    <form className="deliveryFilters deliveryAssignmentFilters" onSubmit={onSubmit}>
      <Select
        aria-label="Assignment status"
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value as DeliveryAssignmentFilters["status"]
          })
        }
        value={filters.status}
      >
        <SelectTrigger>
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any status</SelectItem>
          {DELIVERY_ASSIGNMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {formatDeliveryLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        aria-label="Warehouse"
        disabled={isWarehouseLoading}
        onValueChange={(value) =>
          onChange({
            ...filters,
            warehouseId: value
          })
        }
        value={filters.warehouseId}
      >
        <SelectTrigger>
          <SelectValue placeholder="All visible warehouses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All visible warehouses</SelectItem>
          {warehouses.map((warehouse) => (
            <SelectItem key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        aria-label="Delivery partner"
        onValueChange={(value) =>
          onChange({
            ...filters,
            deliveryPartnerId: value
          })
        }
        value={filters.deliveryPartnerId}
      >
        <SelectTrigger>
          <SelectValue placeholder="All partners" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All partners</SelectItem>
          {partners.map((partner) => (
            <SelectItem key={partner.id} value={partner.id}>
              {partner.fullName} ({partner.mobileNumber})
            </SelectItem>
          ))}
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

function PartnerList({
  isMutating,
  onAction,
  onSelect,
  partners,
  selectedPartnerId
}: {
  isMutating: boolean;
  onAction: (action: "approve" | "reject", partner: AdminDeliveryPartner) => void;
  onSelect: (partnerId: string) => void;
  partners: AdminDeliveryPartner[];
  selectedPartnerId: string | null;
}) {
  if (partners.length === 0) {
    return (
      <EmptyState
        body="No delivery partners match the selected filters."
        title="No delivery partners found"
      />
    );
  }

  return (
    <div className="deliveryPartnerTable" role="table">
      <div className="deliveryPartnerTableHeader" role="row">
        <strong role="columnheader">Partner</strong>
        <strong role="columnheader">Status</strong>
        <strong role="columnheader">Availability</strong>
        <strong role="columnheader">Documents</strong>
        <strong role="columnheader">Actions</strong>
      </div>
      {partners.map((partner) => (
        <div
          className="deliveryPartnerTableRow"
          data-active={partner.id === selectedPartnerId}
          key={partner.id}
          role="row"
        >
          <Button
            className="plainTableButton"
            onClick={() => onSelect(partner.id)}
            type="button"
            variant="ghost"
          >
            <strong>{partner.fullName}</strong>
            <em>{partner.mobileNumber}</em>
          </Button>
          <span role="cell">
            <StatusBadge status={partner.status} />
          </span>
          <span role="cell">
            <AvailabilityBadge isOnline={partner.isOnline} />
          </span>
          <span role="cell">{partner.documents.length} files</span>
          <span className="tableActions" role="cell">
            <PermissionGate permission={ADMIN_PERMISSION.DeliveryAssign}>
              <Button
                className="iconTextButton"
                disabled={isMutating || partner.status === "ACTIVE"}
                onClick={() => onAction("approve", partner)}
                size="sm"
                type="button"
                variant="outline"
              >
                <CheckCircle2 aria-hidden size={16} />
                <span>Approve</span>
              </Button>
              <Button
                className="iconTextButton"
                disabled={isMutating || partner.status === "INACTIVE"}
                onClick={() => onAction("reject", partner)}
                size="sm"
                type="button"
                variant="destructive"
              >
                <XCircle aria-hidden size={16} />
                <span>Reject</span>
              </Button>
            </PermissionGate>
          </span>
        </div>
      ))}
    </div>
  );
}

function PartnerDetail({
  isLoading,
  partner,
  queryError
}: {
  isLoading: boolean;
  partner: AdminDeliveryPartner | null;
  queryError: unknown;
}) {
  if (isLoading) {
    return <LoadingState label="Loading partner detail..." />;
  }

  if (queryError) {
    return (
      <p className="formError" role="alert">
        {getErrorMessage(queryError) ?? "Unable to load partner detail."}
      </p>
    );
  }

  if (!partner) {
    return (
      <EmptyState
        body="Select a delivery partner to view detail."
        title="No partner selected"
      />
    );
  }

  return (
    <div className="deliveryDetailPanel">
      <div className="sectionTitleRow">
        <div>
          <p className="eyebrow">Partner detail</p>
          <h2>{partner.fullName}</h2>
        </div>
        <AvailabilityBadge isOnline={partner.isOnline} />
      </div>
      <div className="detailGrid">
        <DetailItem label="Mobile" value={partner.mobileNumber} />
        <DetailItem label="Email" value={partner.email ?? "-"} />
        <DetailItem label="Status" value={formatDeliveryLabel(partner.status)} />
        <DetailItem label="Vehicle" value={partner.vehicleNumber ?? "-"} />
        <DetailItem label="Wallet" value={formatCurrency(partner.wallet.balance)} />
        <DetailItem label="Earnings" value={formatCurrency(partner.wallet.totalEarnings)} />
        <DetailItem label="Last seen" value={formatDeliveryDateTime(partner.lastSeenAt)} />
        <DetailItem label="Created" value={formatDeliveryDateTime(partner.createdAt)} />
      </div>
      <div className="documentList">
        <div className="sectionTitleRow">
          <h3>Documents</h3>
          <FileText aria-hidden color="var(--primary)" size={20} />
        </div>
        {partner.documents.length === 0 ? (
          <EmptyState body="No documents uploaded." title="No documents found" />
        ) : (
          partner.documents.map((document) => (
            <div className="deliveryDocumentRow" key={document.id}>
              <span>
                <strong>{document.title}</strong>
                <em>{formatDeliveryLabel(document.type)}</em>
              </span>
              <span>{document.verifiedAt ? "Verified" : "Unverified"}</span>
              <Button asChild className="iconTextButton" size="sm" variant="outline">
                <a href={document.fileUrl} rel="noreferrer" target="_blank">
                  <FileText aria-hidden size={16} />
                  <span>View</span>
                </a>
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AssignmentsTable({
  assignments
}: {
  assignments: AdminDeliveryAssignment[];
}) {
  if (assignments.length === 0) {
    return (
      <EmptyState
        body="No delivery assignments match the selected filters."
        title="No delivery assignments found"
      />
    );
  }

  return (
    <div className="deliveryAssignmentTable" role="table">
      <div className="deliveryAssignmentTableHeader" role="row">
        <strong role="columnheader">Order</strong>
        <strong role="columnheader">Partner</strong>
        <strong role="columnheader">Status</strong>
        <strong role="columnheader">Pickup location</strong>
        <strong role="columnheader">Timeline</strong>
        <strong role="columnheader">Proof / issue</strong>
      </div>
      {assignments.map((assignment) => (
        <div className="deliveryAssignmentTableRow" key={assignment.id} role="row">
          <span role="cell">
            <strong>{assignment.orderNumber}</strong>
            <em>{assignment.orderId}</em>
          </span>
          <span role="cell">
            <strong>{assignment.deliveryPartner?.fullName ?? "Unassigned"}</strong>
            <em>{assignment.deliveryPartner?.mobileNumber ?? assignment.deliveryPartnerId}</em>
          </span>
          <span role="cell">
            <StatusBadge status={assignment.status} />
          </span>
          <span role="cell">
            {assignment.pickupWarehouse ? (
              <>
                <strong>{assignment.pickupWarehouse.name}</strong>
                <em>
                  {assignment.pickupWarehouse.address}, {assignment.pickupWarehouse.city}{" "}
                  {assignment.pickupWarehouse.pincode}
                </em>
              </>
            ) : (
              "Order warehouse"
            )}
          </span>
          <span role="cell">
            <AssignmentTimeline assignment={assignment} />
          </span>
          <span role="cell">
            {assignment.proofOfDeliveryUrl ? (
              <Button asChild className="iconTextButton" size="sm" variant="outline">
                <a
                  href={assignment.proofOfDeliveryUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <FileText aria-hidden size={16} />
                  <span>Proof</span>
                </a>
              </Button>
            ) : (
              assignment.failureReason ?? "-"
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function AssignmentTimeline({
  assignment
}: {
  assignment: AdminDeliveryAssignment;
}) {
  if (assignment.statusHistory.length === 0) {
    return (
      <span>
        <strong>{formatDeliveryLabel(assignment.status)}</strong>
        <em>{formatDeliveryDateTime(assignment.assignedAt)}</em>
      </span>
    );
  }

  return (
    <ol className="deliveryTimeline">
      {assignment.statusHistory.map((entry) => (
        <li key={entry.id}>
          <strong>{formatDeliveryLabel(entry.status)}</strong>
          <em>{formatDeliveryDateTime(entry.createdAt)}</em>
          {entry.note ? <span>{entry.note}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function AssignmentForm({
  activePartners,
  assignableOrders,
  error,
  isPending,
  onChange,
  onValidationReset,
  onSubmit,
  showEmptyStates,
  values,
  warehouses
}: {
  activePartners: AdminDeliveryPartner[];
  assignableOrders: AdminOrder[];
  error: string | null;
  isPending: boolean;
  onChange: (values: AssignDeliveryValues) => void;
  onValidationReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showEmptyStates: boolean;
  values: AssignDeliveryValues;
  warehouses: WarehouseListResponse["items"];
}) {
  const canSubmit =
    !isPending &&
    assignableOrders.length > 0 &&
    activePartners.length > 0 &&
    Boolean(values.orderId) &&
    Boolean(values.deliveryPartnerId);

  return (
    <form className="formStack" onSubmit={onSubmit}>
      <div className="formGrid">
        <Select
          aria-label="Order"
          onValueChange={(value) => {
            onValidationReset();
            onChange({
              ...values,
              orderId: value
            });
          }}
          value={values.orderId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select order" />
          </SelectTrigger>
          <SelectContent>
            {assignableOrders.map((order) => (
              <SelectItem key={order.id} value={order.id}>
                {order.orderNumber} ({formatDeliveryLabel(order.status)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          aria-label="Delivery partner"
          onValueChange={(value) => {
            onValidationReset();
            onChange({
              ...values,
              deliveryPartnerId: value
            });
          }}
          value={values.deliveryPartnerId}
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
        <Select
          aria-label="Pickup warehouse"
          onValueChange={(value) =>
            onChange({
              ...values,
              pickupWarehouseId: value
            })
          }
          value={values.pickupWarehouseId}
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
        <label>
          Note
          <Input
            onChange={(event) =>
              onChange({
                ...values,
                note: event.target.value
              })
            }
            placeholder="Pickup instructions"
            value={values.note}
          />
        </label>
      </div>
      {error ? (
        <p className="formError" role="alert">
          {error}
        </p>
      ) : null}
      {showEmptyStates && assignableOrders.length === 0 ? (
        <EmptyState
          body="No confirmed or packed orders are currently assignable."
          title="No assignable orders"
        />
      ) : null}
      {showEmptyStates && activePartners.length === 0 ? (
        <EmptyState
          body="No active delivery partners are available for assignment."
          title="No active partners"
        />
      ) : null}
      <Button
        className="iconTextButton"
        disabled={!canSubmit}
        type="submit"
      >
        <Truck aria-hidden size={16} />
        <span>{isPending ? "Assigning..." : "Assign delivery"}</span>
      </Button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <AdminStatusBadge status={status} />;
}

function AvailabilityBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <span className={`statusBadge ${isOnline ? "statusBadge--active" : "statusBadge--inactive"}`}>
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}

function DetailItem({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="detailItem">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
