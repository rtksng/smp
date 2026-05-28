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
      return;
    }

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
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Delivery operations</p>
            <h2>Admin delivery management</h2>
            <p className="panelSummary">
              Approve delivery partners, review documents, assign orders, and track assignment progress from the admin panel.
            </p>
          </div>
          <button
            className="ghostButton iconTextButton"
            onClick={() => void refreshDeliveryData()}
            type="button"
          >
            <RefreshCw aria-hidden size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <article className="metric metric--primary">
            <span>Partners</span>
            <strong>{partnersQuery.data?.pagination?.total ?? partners.length}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Active visible</span>
            <strong>{partners.filter((partner) => partner.status === "ACTIVE").length}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Pending visible</span>
            <strong>
              {
                partners.filter(
                  (partner) => partner.status === "PENDING_VERIFICATION"
                ).length
              }
            </strong>
          </article>
          <article className="metric metric--primary">
            <span>Online visible</span>
            <strong>{partners.filter((partner) => partner.isOnline).length}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Partners</p>
            <h2>Delivery partner approvals</h2>
          </div>
        </div>
        <PartnerFilterForm
          filters={partnerDraftFilters}
          onChange={setPartnerDraftFilters}
          onReset={resetPartnerFilters}
          onSubmit={applyPartnerFilters}
        />
        <div className="deliveryManagementGrid">
          <div>
            {partnersQuery.isLoading ? (
              <div className="loadingBlock">Loading delivery partners...</div>
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
            <PaginationControls
              isFetching={partnersQuery.isFetching}
              onNext={() => setPartnerPage((current) => current + 1)}
              onPrevious={() => setPartnerPage((current) => Math.max(1, current - 1))}
              pagination={partnersQuery.data?.pagination}
            />
          </div>
          <PartnerDetail
            isLoading={partnerDetailQuery.isLoading}
            partner={selectedPartner}
            queryError={partnerDetailQuery.error}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Assignments</p>
            <h2>Delivery assignments table</h2>
          </div>
        </div>
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
          <div className="loadingBlock">Loading delivery assignments...</div>
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
        <PaginationControls
          isFetching={assignmentsQuery.isFetching}
          onNext={() => setAssignmentPage((current) => current + 1)}
          onPrevious={() => setAssignmentPage((current) => Math.max(1, current - 1))}
          pagination={assignmentsQuery.data?.pagination}
        />
      </section>

      <PermissionGate permission={ADMIN_PERMISSION.DeliveryAssign}>
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Assignment</p>
              <h2>Assign order to delivery partner</h2>
            </div>
          </div>
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
            <div className="loadingBlock">Loading assignable orders...</div>
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
            onChange={setAssignmentForm}
            onSubmit={requestAssignment}
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
      <label>
        Partner status
        <select
          onChange={(event) =>
            onChange({
              status: event.target.value as DeliveryPartnerFilters["status"]
            })
          }
          value={filters.status}
        >
          <option value="">Any status</option>
          {DELIVERY_PARTNER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatDeliveryLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <div className="productFilterActions">
        <button className="primaryButton iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>Apply</span>
        </button>
        <button className="ghostButton" onClick={onReset} type="button">
          Reset
        </button>
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
      <label>
        Assignment status
        <select
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as DeliveryAssignmentFilters["status"]
            })
          }
          value={filters.status}
        >
          <option value="">Any status</option>
          {DELIVERY_ASSIGNMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatDeliveryLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Warehouse
        <select
          disabled={isWarehouseLoading}
          onChange={(event) =>
            onChange({
              ...filters,
              warehouseId: event.target.value
            })
          }
          value={filters.warehouseId}
        >
          <option value="">All visible warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code})
            </option>
          ))}
        </select>
      </label>
      <label>
        Delivery partner
        <select
          onChange={(event) =>
            onChange({
              ...filters,
              deliveryPartnerId: event.target.value
            })
          }
          value={filters.deliveryPartnerId}
        >
          <option value="">All partners</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.fullName} ({partner.mobileNumber})
            </option>
          ))}
        </select>
      </label>
      <div className="productFilterActions">
        <button className="primaryButton iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>Apply</span>
        </button>
        <button className="ghostButton" onClick={onReset} type="button">
          Reset
        </button>
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
    return <div className="emptyPanel smallEmpty">No delivery partners match the selected filters.</div>;
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
          <button
            className="plainTableButton"
            onClick={() => onSelect(partner.id)}
            type="button"
          >
            <strong>{partner.fullName}</strong>
            <em>{partner.mobileNumber}</em>
          </button>
          <span role="cell">
            <StatusBadge status={partner.status} />
          </span>
          <span role="cell">
            <AvailabilityBadge isOnline={partner.isOnline} />
          </span>
          <span role="cell">{partner.documents.length} files</span>
          <span className="tableActions" role="cell">
            <PermissionGate permission={ADMIN_PERMISSION.DeliveryAssign}>
              <button
                className="ghostButton iconTextButton"
                disabled={isMutating || partner.status === "ACTIVE"}
                onClick={() => onAction("approve", partner)}
                type="button"
              >
                <CheckCircle2 aria-hidden size={16} />
                <span>Approve</span>
              </button>
              <button
                className="dangerButton iconTextButton"
                disabled={isMutating || partner.status === "INACTIVE"}
                onClick={() => onAction("reject", partner)}
                type="button"
              >
                <XCircle aria-hidden size={16} />
                <span>Reject</span>
              </button>
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
    return <div className="loadingBlock">Loading partner detail...</div>;
  }

  if (queryError) {
    return (
      <p className="formError" role="alert">
        {getErrorMessage(queryError) ?? "Unable to load partner detail."}
      </p>
    );
  }

  if (!partner) {
    return <div className="emptyPanel smallEmpty">Select a delivery partner to view detail.</div>;
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
          <div className="emptyPanel smallEmpty">No documents uploaded.</div>
        ) : (
          partner.documents.map((document) => (
            <div className="deliveryDocumentRow" key={document.id}>
              <span>
                <strong>{document.title}</strong>
                <em>{formatDeliveryLabel(document.type)}</em>
              </span>
              <span>{document.verifiedAt ? "Verified" : "Unverified"}</span>
              <a
                className="ghostButton iconTextButton"
                href={document.fileUrl}
                rel="noreferrer"
                target="_blank"
              >
                <FileText aria-hidden size={16} />
                <span>View</span>
              </a>
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
    return <div className="emptyPanel smallEmpty">No delivery assignments match the selected filters.</div>;
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
              <a
                className="ghostButton iconTextButton"
                href={assignment.proofOfDeliveryUrl}
                rel="noreferrer"
                target="_blank"
              >
                <FileText aria-hidden size={16} />
                <span>Proof</span>
              </a>
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
  isPending,
  onChange,
  onSubmit,
  values,
  warehouses
}: {
  activePartners: AdminDeliveryPartner[];
  assignableOrders: AdminOrder[];
  isPending: boolean;
  onChange: (values: AssignDeliveryValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  values: AssignDeliveryValues;
  warehouses: WarehouseListResponse["items"];
}) {
  return (
    <form className="formStack" onSubmit={onSubmit}>
      <div className="formGrid">
        <label>
          Order
          <select
            onChange={(event) =>
              onChange({
                ...values,
                orderId: event.target.value
              })
            }
            required
            value={values.orderId}
          >
            <option value="">Select order</option>
            {assignableOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderNumber} ({formatDeliveryLabel(order.status)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Delivery partner
          <select
            onChange={(event) =>
              onChange({
                ...values,
                deliveryPartnerId: event.target.value
              })
            }
            required
            value={values.deliveryPartnerId}
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
            onChange={(event) =>
              onChange({
                ...values,
                pickupWarehouseId: event.target.value
              })
            }
            value={values.pickupWarehouseId}
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
          <input
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
      {assignableOrders.length === 0 ? (
        <div className="emptyPanel smallEmpty">No confirmed or packed orders are currently assignable.</div>
      ) : null}
      {activePartners.length === 0 ? (
        <div className="emptyPanel smallEmpty">No active delivery partners are available for assignment.</div>
      ) : null}
      <button
        className="primaryButton iconTextButton"
        disabled={isPending || activePartners.length === 0 || assignableOrders.length === 0}
        type="submit"
      >
        <Truck aria-hidden size={16} />
        <span>{isPending ? "Assigning..." : "Assign delivery"}</span>
      </button>
    </form>
  );
}

function PaginationControls({
  isFetching,
  onNext,
  onPrevious,
  pagination
}: {
  isFetching: boolean;
  onNext: () => void;
  onPrevious: () => void;
  pagination: PaginatedResponse<unknown>["pagination"] | undefined;
}) {
  if (!pagination) {
    return null;
  }

  return (
    <div className="paginationControls">
      <button
        className="ghostButton"
        disabled={!pagination.hasPreviousPage || isFetching}
        onClick={onPrevious}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {pagination.page} of {Math.max(1, pagination.totalPages)}
      </span>
      <button
        className="ghostButton"
        disabled={!pagination.hasNextPage || isFetching}
        onClick={onNext}
        type="button"
      >
        Next
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`statusBadge statusBadge--${status.toLowerCase()}`}>
      {formatDeliveryLabel(status)}
    </span>
  );
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
