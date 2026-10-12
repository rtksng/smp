"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Pencil,
  RefreshCw,
  Search,
  Truck,
  UserPlus,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Fragment,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import { AdminShell } from "../../admin-shell";
import { DeliveryBulkAssignment } from "./delivery-bulk-assignment";
import { DeliveryPartnerEarningsPanel } from "./delivery-partner-earnings";
import { DeliveryWarehouseList } from "./delivery-partner-form";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import {
  PermissionGate,
  ProtectedRoute,
  useAdminSession
} from "../../../lib/admin-session";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import {
  PaginationControls as SharedPaginationControls
} from "@/components/admin/pagination-controls";
import { StatusBadge as AdminStatusBadge } from "@/components/admin/status-badge";
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
import {
  buildAssignDeliveryPayload,
  canAssignDelivery,
  formatCurrency,
  type AdminOrder,
  type AssignDeliveryValues,
  type PaginatedResponse as OrderPaginatedResponse
} from "../../../lib/order-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import { useTableOverflow } from "../../../lib/use-table-overflow";
import type { WarehouseListResponse } from "../../../lib/warehouse-management";
import {
  DELIVERY_ASSIGNMENT_STATUSES,
  DELIVERY_PARTNER_STATUSES,
  buildDeliveryAssignmentQuery,
  buildDeliveryPartnerQuery,
  createEmptyDeliveryAssignmentFilters,
  createEmptyDeliveryPartnerFilters,
  DELIVERY_PARTNER_SEARCH_MAX_LENGTH,
  filterPartnersForWarehouse,
  formatDeliveryDate,
  formatDeliveryDateTime,
  formatDeliveryLabel,
  formatDeliveryPartnerPay,
  formatDeliveryPartnerWarehouses,
  formatDeliveryWarehouseName,
  getEffectivePickupWarehouseId,
  isPartnerAssignedToWarehouse,
  loadDeliveryOptions,
  type AdminDeliveryAssignment,
  type AdminDeliveryPartner,
  type DeliveryAssignmentFilters,
  type DeliveryPartnerFilters,
  type PaginatedResponse
} from "../../../lib/delivery-management";
import "../delivery-responsive.css";

const DELIVERY_PAGE_SIZE = 20;
const deliveryChartColors = {
  accent: "#587570",
  muted: "#94a3b8",
  primary: "#0f6f68",
  warning: "#b87605"
};
const emptyAssignmentForm: AssignDeliveryValues = {
  deliveryPartnerId: "",
  note: "",
  orderId: "",
  pickupWarehouseId: ""
};

type DeliveryView = "analytics" | "partners" | "requests" | "assignments" | "assign";
type AssignmentFilters = DeliveryAssignmentFilters & { search: string };

const deliveryCopy: Record<DeliveryView, { summary: string; title: string }> = {
  analytics: {
    summary: "Review delivery coverage, partner availability, and assignment trends.",
    title: "Delivery analytics"
  },
  assign: {
    summary: "Create a delivery assignment from one focused order-to-partner form.",
    title: "Assign delivery"
  },
  assignments: {
    summary: "Filter and inspect delivery assignments in a table-first operations view.",
    title: "Delivery assignments"
  },
  partners: {
    summary: "Search delivery partners, review warehouses and pay, and open partner profiles.",
    title: "Delivery partners"
  },
  requests: {
    summary: "Review partner applications from the delivery app and approve or reject them.",
    title: "Partner requests"
  }
};

export function DeliveryRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.DeliveryRead}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function DeliveryLandingPage() {
  return <DeliveryContent view="analytics" />;
}

export function DeliveryPartnersPage() {
  return <DeliveryContent view="partners" />;
}

export function DeliveryRequestsPage() {
  return <DeliveryContent view="requests" />;
}

export function DeliveryPartnerDetailPage({ partnerId }: { partnerId: string }) {
  const { api, hasPermission } = useAdminSession();
  const partnerQuery = useQuery({
    queryFn: () =>
      api.request<AdminDeliveryPartner>(`/admin/delivery-partners/${partnerId}`),
    queryKey: ["admin", "delivery", "partner", partnerId]
  });
  const canManagePartners = hasPermission(ADMIN_PERMISSION.DeliveryPartnersManage);

  return (
    <div className="deliveryModule deliveryPartnerDetailModule">
      <section className="panel deliveryPartnerDetailPagePanel">
        <PageHeader
          actions={
            partnerQuery.data ? (
              <div className="actionRow deliveryHeaderActions deliveryPartnerDetailActions">
                <AvailabilityBadge isOnline={partnerQuery.data.isOnline} />
                {canManagePartners ? (
                  <Button asChild className="iconTextButton" variant="outline">
                    <Link href={`/delivery/partners/${partnerQuery.data.id}/edit`}>
                      <Pencil aria-hidden size={16} />
                      <span>Edit partner</span>
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : undefined
          }
          backHref="/delivery/partners"
          backLabel="Back to partners"
          className="settingsSectionHeader deliverySectionHeader deliveryPartnerDetailHeader"
          eyebrow="Partner detail"
          title={partnerQuery.data?.fullName ?? "Delivery partner"}
        />
        <PartnerDetail
          isLoading={partnerQuery.isLoading}
          partner={partnerQuery.data ?? null}
          queryError={partnerQuery.error}
        />
      </section>
      {partnerQuery.data ? <DeliveryPartnerEarningsPanel partner={partnerQuery.data} /> : null}
    </div>
  );
}

export function DeliveryAssignmentsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading delivery assignments..." />}>
      <DeliveryAssignmentDestination />
    </Suspense>
  );
}

function DeliveryAssignmentDestination() {
  const searchKey = useSearchParams().toString();
  const params = new URLSearchParams(searchKey);
  const status = params.get("status") ?? "";
  const initialAssignmentFilters: AssignmentFilters = {
    ...createEmptyDeliveryAssignmentFilters(),
    status: DELIVERY_ASSIGNMENT_STATUSES.some((item) => item === status)
      ? status as AssignmentFilters["status"]
      : "",
    search: (params.get("search") ?? "").trim().slice(0, 100),
    deliveryPartnerId: params.get("deliveryPartnerId") ?? "",
    warehouseId: params.get("warehouseId") ?? ""
  };

  // Remount the filter state when another notification opens this same route.
  return <DeliveryContent key={searchKey} initialAssignmentFilters={initialAssignmentFilters} view="assignments" />;
}

export function DeliveryAssignPage() {
  return <DeliveryContent view="assign" />;
}

function DeliveryContent({
  view,
  initialAssignmentFilters = { ...createEmptyDeliveryAssignmentFilters(), search: "" }
}: {
  view: DeliveryView;
  initialAssignmentFilters?: AssignmentFilters;
}) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [partnerPage, setPartnerPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [partnerDraftFilters, setPartnerDraftFilters] =
    useState<DeliveryPartnerFilters>(() => createPartnerFilters(view));
  const [partnerFilters, setPartnerFilters] = useState<DeliveryPartnerFilters>(
    () => createPartnerFilters(view)
  );
  const [assignmentDraftFilters, setAssignmentDraftFilters] =
    useState<AssignmentFilters>(initialAssignmentFilters);
  const [assignmentFilters, setAssignmentFilters] =
    useState<AssignmentFilters>(initialAssignmentFilters);
  const [assignmentForm, setAssignmentForm] =
    useState<AssignDeliveryValues>(emptyAssignmentForm);

  const partnerQuery = useMemo(
    () => buildDeliveryPartnerQuery(partnerFilters, partnerPage, DELIVERY_PAGE_SIZE),
    [partnerFilters, partnerPage]
  );
  const assignmentQuery = useMemo(
    () => ({
      ...buildDeliveryAssignmentQuery(
        assignmentFilters,
        assignmentPage,
        DELIVERY_PAGE_SIZE
      ),
      search: assignmentFilters.search.trim().slice(0, 100) || undefined
    }),
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
  const assignmentsQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedResponse<AdminDeliveryAssignment>>(
        "/admin/delivery/assignments",
        {
          query: assignmentQuery
        }
      ),
    queryKey: ["admin", "delivery", "assignments", assignmentQuery],
    refetchInterval: 15_000
  });
  const partnerOptionsQuery = useQuery({
    enabled: view === "assign" || view === "assignments",
    queryFn: () => loadDeliveryOptions((page) =>
      api.request<PaginatedResponse<AdminDeliveryPartner>>("/admin/delivery-partners", {
        query: { limit: 100, page, status: view === "assign" ? "ACTIVE" : undefined }
      })),
    queryKey: ["admin", "delivery", "partner-options", view]
  });
  const ordersQuery = useQuery({
    enabled: view === "assign" && hasPermission(ADMIN_PERMISSION.OrdersRead),
    queryFn: async () => (await Promise.all(["CONFIRMED", "PACKED"].map((status) =>
      loadDeliveryOptions((page) => api.request<OrderPaginatedResponse<AdminOrder>>("/admin/orders", {
        query: { limit: 100, page, status }
      }))
    ))).flat(),
    queryKey: ["admin", "delivery", "orders"]
  });
  const warehousesQuery = useQuery({
    enabled: (view === "assign" || view === "assignments") && hasPermission(ADMIN_PERMISSION.WarehouseRead),
    queryFn: () => loadDeliveryOptions((page) =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: { limit: 100, page, status: view === "assign" ? "ACTIVE" : undefined }
      })),
    queryKey: ["admin", "delivery", "warehouses", view]
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
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data]
  );
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const activePartners = useMemo(
    () => (partnerOptionsQuery.data ?? []).filter((partner) => partner.status === "ACTIVE"),
    [partnerOptionsQuery.data]
  );
  const assignableOrders = useMemo(
    () => orders.filter((order) => canAssignDelivery(order.status)),
    [orders]
  );
  const selectedAssignmentOrder =
    assignableOrders.find((order) => order.id === assignmentForm.orderId) ?? null;
  const assignmentWarehouseId = getEffectivePickupWarehouseId(
    assignmentForm.pickupWarehouseId,
    selectedAssignmentOrder
  );
  // The API dispatches only partners linked to the pickup warehouse, so the form offers just those.
  const assignmentPartners = useMemo(
    () => filterPartnersForWarehouse(activePartners, assignmentWarehouseId),
    [activePartners, assignmentWarehouseId]
  );
  const assignmentWarehouseName = getAssignmentWarehouseName(
    assignmentWarehouseId,
    warehouses,
    selectedAssignmentOrder
  );
  const canManagePartners = hasPermission(ADMIN_PERMISSION.DeliveryPartnersManage);
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

  async function refreshDeliveryData() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "delivery"] });
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
    const emptyFilters = createPartnerFilters(view);
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
    const emptyFilters = { ...createEmptyDeliveryAssignmentFilters(), search: "" };
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

  function changeAssignmentForm(nextValues: AssignDeliveryValues) {
    const order = assignableOrders.find((item) => item.id === nextValues.orderId) ?? null;
    const warehouseId = getEffectivePickupWarehouseId(nextValues.pickupWarehouseId, order);
    const partner = activePartners.find((item) => item.id === nextValues.deliveryPartnerId);
    // Changing the order or pickup warehouse clears a partner who does not serve the new warehouse.
    const keepsPartner =
      !partner || !warehouseId || isPartnerAssignedToWarehouse(partner, warehouseId);

    setAssignmentForm(keepsPartner ? nextValues : { ...nextValues, deliveryPartnerId: "" });
  }

  function requestAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const order = assignableOrders.find((item) => item.id === assignmentForm.orderId);
    const partner = assignmentPartners.find(
      (item) => item.id === assignmentForm.deliveryPartnerId
    );

    if (!order || !partner) {
      setAssignmentError(
        "Select an order and an active delivery partner assigned to its pickup warehouse before assigning delivery."
      );
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

  const pageCopy = deliveryCopy[view];
  const totalPartners = partnersQuery.data?.pagination?.total ?? partners.length;
  const activeVisibleCount = partners.filter((partner) => partner.status === "ACTIVE").length;
  const pendingVisibleCount = partners.filter(
    (partner) => partner.status === "PENDING_VERIFICATION"
  ).length;
  const onlineVisibleCount = partners.filter((partner) => partner.isOnline).length;
  const totalAssignments = assignmentsQuery.data?.pagination?.total ?? assignments.length;
  const pendingAssignmentCount = assignments.filter((assignment) =>
    ["ASSIGNED", "ACCEPTED", "PICKED_UP"].includes(assignment.status)
  ).length;

  return (
    <div className="deliveryModule" data-delivery-view={view}>
      <section className="panel deliveryOverviewPanel">
        <PageHeader
          actions={
            <div className="actionRow deliveryHeaderActions">
              <Button
                className="iconTextButton"
                onClick={() => void refreshDeliveryData()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="deliveryPageHeader"
          eyebrow="Delivery operations"
          summary={pageCopy.summary}
          title={pageCopy.title}
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        {view === "analytics" ? (
          <div className="metricGrid resourceMetrics deliveryMetricGrid">
            <MetricCard label="Partners" tone="primary" value={totalPartners} />
            <MetricCard label="Active visible" value={activeVisibleCount} />
            <MetricCard label="Pending visible" tone="warning" value={pendingVisibleCount} />
            <MetricCard label="Online visible" tone="primary" value={onlineVisibleCount} />
            <MetricCard label="Assignments" value={totalAssignments} />
            <MetricCard label="In progress" tone="warning" value={pendingAssignmentCount} />
          </div>
        ) : null}
      </section>

      {view === "analytics" ? (
        <DeliveryOverviewCharts assignments={assignments} partners={partners} />
      ) : null}

      {view === "partners" || view === "requests" ? (
        <section className="panel deliveryPartnersPanel mt-3">
          {view === "requests" ? (
            <PageHeader
              className="settingsSectionHeader deliverySectionHeader deliveryListHeader"
              eyebrow="Requests"
              level={2}
              summary="Partners who registered from the delivery app wait here until they are approved or rejected."
              title="Pending applications"
            />
          ) : (
            <PageHeader
              actions={
                canManagePartners ? (
                  <Button asChild className="iconTextButton">
                    <Link href="/delivery/partners/new">
                      <UserPlus aria-hidden size={16} />
                      <span>Add partner</span>
                    </Link>
                  </Button>
                ) : undefined
              }
              className="settingsSectionHeader deliverySectionHeader deliveryListHeader"
              eyebrow="Partners"
              level={2}
              summary="Search partner records, approve verification, and open one profile for warehouses, pay, and documents."
              title="Partner directory"
            />
          )}
          <PartnerFilterForm
            filters={partnerDraftFilters}
            onChange={setPartnerDraftFilters}
            onReset={resetPartnerFilters}
            onSubmit={applyPartnerFilters}
            showStatus={view === "partners"}
          />
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
              emptyState={
                view === "requests"
                  ? {
                      body: "New partner applications from the delivery app will appear here.",
                      title: "No pending requests"
                    }
                  : undefined
              }
              isMutating={isMutating}
              onAction={requestPartnerAction}
              partners={partners}
            />
          ) : null}
          {partnersQuery.data?.pagination ? (
            <SharedPaginationControls
              onChange={setPartnerPage}
              page={partnersQuery.data.pagination.page}
              pageSize={partnersQuery.data.pagination.limit}
              totalItems={partnersQuery.data.pagination.total}
              totalPages={Math.max(partnersQuery.data.pagination.totalPages, 1)}
            />
          ) : null}
        </section>
      ) : null}

      {view === "assignments" ? (
        <section className="panel deliveryAssignmentsPanel mt-3">
          <PageHeader
            className="settingsSectionHeader deliverySectionHeader"
            eyebrow="Assignments"
            level={2}
            summary="Use filters to audit delivery progress, proof, pickup location, and issue history."
            title="Assignment tracking"
          />
          <AssignmentFilterForm
            filters={assignmentDraftFilters}
            isWarehouseLoading={warehousesQuery.isLoading}
            onChange={setAssignmentDraftFilters}
            onReset={resetAssignmentFilters}
            onSubmit={applyAssignmentFilters}
            partners={partnerOptionsQuery.data ?? []}
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
              pageSize={assignmentsQuery.data.pagination.limit}
              totalItems={assignmentsQuery.data.pagination.total}
              totalPages={Math.max(assignmentsQuery.data.pagination.totalPages, 1)}
            />
          ) : null}
        </section>
      ) : null}

      {view === "assign" ? (
        <PermissionGate permission={ADMIN_PERMISSION.DeliveryAssign}>
          <section className="panel deliveryAssignPanel mt-3">
            <PageHeader
              className="settingsSectionHeader deliverySectionHeader"
              eyebrow="Assignment"
              level={2}
              summary="Choose an assignable order, active partner, optional pickup warehouse, and dispatch note."
              title="Assign order"
            />
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
            {partnerOptionsQuery.isLoading ? <LoadingState label="Loading active delivery partners..." /> : null}
            {partnerOptionsQuery.isError || warehousesQuery.isError ? (
              <p className="formError" role="alert">
                {getErrorMessage(partnerOptionsQuery.error) ?? getErrorMessage(warehousesQuery.error)}
              </p>
            ) : null}
            <AssignmentForm
              activePartnerCount={activePartners.length}
              assignableOrders={assignableOrders}
              canManagePartners={canManagePartners}
              isPending={assignMutation.isPending}
              error={assignmentError}
              onChange={changeAssignmentForm}
              onValidationReset={() => setAssignmentError(null)}
              onSubmit={requestAssignment}
              partners={assignmentPartners}
              pickupWarehouse={
                assignmentWarehouseId
                  ? { id: assignmentWarehouseId, name: assignmentWarehouseName }
                  : null
              }
              showEmptyStates={
                !ordersQuery.isLoading &&
                !ordersQuery.isError &&
                !partnerOptionsQuery.isLoading &&
                !partnerOptionsQuery.isError
              }
              values={assignmentForm}
              warehouses={warehouses}
            />
            {hasPermission(ADMIN_PERMISSION.OrdersRead) ? <DeliveryBulkAssignment
              orders={assignableOrders} partners={activePartners} warehouses={warehouses}
              disabled={isMutating || ordersQuery.isFetching || ordersQuery.isError || partnerOptionsQuery.isFetching || partnerOptionsQuery.isError || warehousesQuery.isError}
              onComplete={invalidateDeliveryData} /> : null}
          </section>
        </PermissionGate>
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

/** Requests are partner applications, so that view always lists partners awaiting verification. */
function createPartnerFilters(view: DeliveryView): DeliveryPartnerFilters {
  return view === "requests"
    ? { ...createEmptyDeliveryPartnerFilters(), status: "PENDING_VERIFICATION" }
    : createEmptyDeliveryPartnerFilters();
}

type DeliveryStatusChartRow = {
  count: number;
  label: string;
  status: string;
};

type DeliveryTrendChartRow = {
  count: number;
  dateKey: string;
  label: string;
};

function DeliveryOverviewCharts({
  assignments,
  partners
}: {
  assignments: AdminDeliveryAssignment[];
  partners: AdminDeliveryPartner[];
}) {
  const partnerStatusData = buildPartnerStatusChartData(partners);
  const assignmentStatusData = buildAssignmentStatusChartData(assignments);
  const assignmentTrendData = buildAssignmentTrendChartData(assignments);

  return (
    <section className="deliveryChartsGrid" aria-label="Delivery overview charts">
      <DeliveryChartPanel
        emptyState="No delivery partners found."
        isEmpty={false}
        summary="Current partner verification mix from the visible partner result set."
        title="Partner status mix"
      >
        <DeliveryStatusChart data={partnerStatusData} valueLabel="partners" />
      </DeliveryChartPanel>

      <DeliveryChartPanel
        emptyState="No delivery assignments found."
        isEmpty={false}
        summary="Visible assignment workload grouped by delivery status."
        title="Assignment workload"
      >
        <DeliveryStatusChart data={assignmentStatusData} valueLabel="assignments" />
      </DeliveryChartPanel>

      <DeliveryChartPanel
        emptyState="No recent delivery assignments found."
        isEmpty={false}
        summary="Assignment volume over the latest seven-day window in the visible data."
        title="Recent assignment volume"
        wide
      >
        <DeliveryAssignmentTrendChart data={assignmentTrendData} />
      </DeliveryChartPanel>
    </section>
  );
}

function DeliveryStatusChart({
  data,
  valueLabel
}: {
  data: DeliveryStatusChartRow[];
  valueLabel: string;
}) {
  return (
    <DeliveryChartFrame>
      {(width) => (
        <BarChart
          data={data}
          height={280}
          layout="vertical"
          margin={{ bottom: 4, left: 6, right: 18, top: 4 }}
          width={width}
        >
          <CartesianGrid horizontal={false} stroke="#e0ecea" />
          <XAxis
            allowDecimals={false}
            axisLine={false}
            domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
            fontSize={12}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="label"
            fontSize={12}
            tickLine={false}
            type="category"
            width={104}
          />
          <RechartsTooltip
            formatter={(value) => [`${value} ${valueLabel}`, "Count"]}
          />
          <Bar
            background={{ fill: "#e0ecea", radius: 6 }}
            dataKey="count"
            name={valueLabel}
            radius={[0, 6, 6, 0]}
          >
            {data.map((item, index) => (
              <Cell
                fill={getDeliveryStatusChartColor(item.status, index)}
                key={item.status}
              />
            ))}
          </Bar>
        </BarChart>
      )}
    </DeliveryChartFrame>
  );
}

function DeliveryAssignmentTrendChart({ data }: { data: DeliveryTrendChartRow[] }) {
  return (
    <DeliveryChartFrame height={300}>
      {(width) => (
        <LineChart
          data={data}
          height={300}
          margin={{ bottom: 4, left: 0, right: 18, top: 12 }}
          width={width}
        >
          <CartesianGrid stroke="#e0ecea" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={12}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
            fontSize={12}
            tickLine={false}
            width={34}
          />
          <RechartsTooltip formatter={(value) => [`${value} assignments`, "Volume"]} />
          <Line
            activeDot={{ r: 6 }}
            dataKey="count"
            dot={{ r: 4 }}
            name="Assignments"
            stroke={deliveryChartColors.primary}
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      )}
    </DeliveryChartFrame>
  );
}

function DeliveryChartFrame({
  children,
  height = 280
}: {
  children: (width: number) => ReactNode;
  height?: number;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const syncWidth = () => {
      const nextWidth = Math.floor(frame.getBoundingClientRect().width);

      if (nextWidth > 0) {
        setWidth(nextWidth);
      }
    };
    const resizeObserver = new ResizeObserver(syncWidth);

    syncWidth();
    resizeObserver.observe(frame);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="dashboardChartFrame" ref={frameRef} style={{ height }}>
      {children(width)}
    </div>
  );
}

function DeliveryChartPanel({
  children,
  emptyState,
  isEmpty,
  summary,
  title,
  wide = false
}: {
  children: ReactNode;
  emptyState: string;
  isEmpty: boolean;
  summary: string;
  title: string;
  wide?: boolean;
}) {
  return (
    <section
      className="panel dashboardChartPanel deliveryChartPanel"
      data-wide={wide ? "true" : undefined}
    >
      <div className="dashboardChartHeader">
        <span>
          <strong>{title}</strong>
          <em>{summary}</em>
        </span>
      </div>
      {isEmpty ? <div className="emptyPanel smallEmpty">{emptyState}</div> : children}
    </section>
  );
}

function buildPartnerStatusChartData(
  partners: AdminDeliveryPartner[]
): DeliveryStatusChartRow[] {
  return DELIVERY_PARTNER_STATUSES.map((status) => ({
    count: partners.filter((partner) => partner.status === status).length,
    label: formatDeliveryLabel(status),
    status
  }));
}

function buildAssignmentStatusChartData(
  assignments: AdminDeliveryAssignment[]
): DeliveryStatusChartRow[] {
  return DELIVERY_ASSIGNMENT_STATUSES.map((status) => ({
    count: assignments.filter((assignment) => assignment.status === status).length,
    label: formatDeliveryLabel(status),
    status
  }));
}

function buildAssignmentTrendChartData(
  assignments: AdminDeliveryAssignment[]
): DeliveryTrendChartRow[] {
  const assignmentDates = assignments
    .map((assignment) => new Date(assignment.assignedAt || assignment.createdAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());
  const endDate = assignmentDates[0] ?? new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6);
  startDate.setHours(0, 0, 0, 0);

  const rows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      count: 0,
      dateKey: getDeliveryChartDateKey(date),
      label: formatDeliveryChartDateLabel(date)
    };
  });
  const rowsByDate = new Map(rows.map((row) => [row.dateKey, row]));

  assignments.forEach((assignment) => {
    const date = new Date(assignment.assignedAt || assignment.createdAt);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const row = rowsByDate.get(getDeliveryChartDateKey(date));

    if (row) {
      row.count += 1;
    }
  });

  return rows;
}

function getDeliveryStatusChartColor(status: string, index: number) {
  const normalizedStatus = status.toLowerCase();

  if (
    normalizedStatus.includes("active") ||
    normalizedStatus.includes("delivered") ||
    normalizedStatus.includes("accepted")
  ) {
    return deliveryChartColors.primary;
  }

  if (
    normalizedStatus.includes("pending") ||
    normalizedStatus.includes("assigned") ||
    normalizedStatus.includes("picked") ||
    normalizedStatus.includes("out_for_delivery")
  ) {
    return deliveryChartColors.warning;
  }

  if (
    normalizedStatus.includes("inactive") ||
    normalizedStatus.includes("failed") ||
    normalizedStatus.includes("cancelled") ||
    normalizedStatus.includes("rejected") ||
    normalizedStatus.includes("suspended")
  ) {
    return "#b91c1c";
  }

  return index % 2 === 0 ? deliveryChartColors.accent : deliveryChartColors.muted;
}

function getDeliveryChartDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDeliveryChartDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

function PartnerFilterForm({
  filters,
  onChange,
  onReset,
  onSubmit,
  showStatus = true
}: {
  filters: DeliveryPartnerFilters;
  onChange: (filters: DeliveryPartnerFilters) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showStatus?: boolean;
}) {
  // Search and status sit under the list header, which keeps the add action on the heading row.
  return (
    <form
      className="deliveryFilters deliveryPartnerFilters"
      data-status-filter={showStatus ? undefined : "hidden"}
      onSubmit={onSubmit}
      role="search"
    >
      <Input
        aria-label="Search delivery partners"
        maxLength={DELIVERY_PARTNER_SEARCH_MAX_LENGTH}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
        placeholder="Search name, mobile, or vehicle"
        value={filters.search}
      />
      {showStatus ? (
        <Select
          aria-label="Partner status"
          onValueChange={(value) =>
            onChange({
              ...filters,
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
      ) : null}
      <div className="deliveryPartnerFilterActions">
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
  filters: AssignmentFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: AssignmentFilters) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  partners: AdminDeliveryPartner[];
  warehouses: WarehouseListResponse["items"];
}) {
  return (
    <form className="deliveryFilters deliveryAssignmentFilters" onSubmit={onSubmit}>
      <Input
        aria-label="Search delivery assignments"
        maxLength={100}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
        placeholder="Search order or customer"
        value={filters.search}
      />
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
  emptyState = {
    body: "No delivery partners match the selected filters.",
    title: "No delivery partners found"
  },
  isMutating,
  onAction,
  partners
}: {
  emptyState?: { body: string; title: string };
  isMutating: boolean;
  onAction: (action: "approve" | "reject", partner: AdminDeliveryPartner) => void;
  partners: AdminDeliveryPartner[];
}) {
  const { isOverflowing, shellRef } = useTableOverflow(partners.length > 0);

  if (partners.length === 0) {
    return <EmptyState body={emptyState.body} title={emptyState.title} />;
  }

  return (
    <div
      className="deliveryTableShell deliveryPartnerTableShell"
      data-overflowing={isOverflowing ? "true" : undefined}
      ref={shellRef}
    >
      {isOverflowing ? (
        <p className="deliveryTableHint" id="delivery-partner-table-hint">
          Swipe sideways to view every partner option.
        </p>
      ) : null}
      <div className="resourceTable deliveryPartnerDataTable">
        <Table aria-describedby="delivery-partner-table-hint" aria-label="Delivery partners">
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Warehouses</TableHead>
              <TableHead>Pay</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((partner) => (
              <TableRow key={partner.id}>
                <TableCell className="deliveryPartnerCell">
                  <strong>{partner.fullName}</strong>
                  <em>{partner.mobileNumber}</em>
                </TableCell>
                <TableCell className="deliveryStatusCell">
                  <StatusBadge status={partner.status} />
                </TableCell>
                <TableCell className="deliveryAvailabilityCell">
                  <AvailabilityBadge isOnline={partner.isOnline} />
                </TableCell>
                <TableCell
                  className="deliveryWarehousesCell"
                  data-empty={partner.warehouses.length === 0 ? "true" : undefined}
                  data-label="Warehouses"
                >
                  {formatDeliveryPartnerWarehouses(partner.warehouses)}
                </TableCell>
                <TableCell className="deliveryPayCell" data-label="Pay">
                  {formatDeliveryPartnerPay(partner.payment)}
                </TableCell>
                <TableCell className="deliveryDocumentsCell" data-label="Documents">
                  {partner.documents.length} files
                </TableCell>
                <TableCell className="deliveryDetailCell">
                  <Button asChild className="iconTextButton" size="sm" variant="outline">
                    <Link href={`/delivery/partners/${partner.id}`}>
                      <Eye aria-hidden size={14} />
                      <span>View</span>
                    </Link>
                  </Button>
                </TableCell>
                <TableCell className="deliveryActionsCell">
                  <div className="tableActions deliveryPartnerTableActions">
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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

  // The page header already shows the partner name and availability, so the detail starts with facts.
  // Wallet figures live in the earnings panel below.
  return (
    <div className="deliveryDetailPanel">
      <div className="detailGrid">
        <DetailItem label="Mobile" value={partner.mobileNumber} />
        <DetailItem label="Email" value={partner.email ?? "-"} wide />
        <DetailItem label="Status" value={formatDeliveryLabel(partner.status)} />
        <DetailItem label="Vehicle" value={partner.vehicleNumber ?? "-"} />
        <DetailItem label="Pay" value={formatDeliveryPartnerPay(partner.payment)} wide />
        <DetailItem label="Last seen" value={formatDeliveryDateTime(partner.lastSeenAt)} />
        <DetailItem label="Created" value={formatDeliveryDateTime(partner.createdAt)} />
        {/* Each warehouse gets its own pair so the date is never read against the wrong warehouse. */}
        {partner.warehouses.length === 0 ? (
          <>
            <DetailItem label="Associated warehouse" value="Not assigned" wide />
            <DetailItem label="Association date" value="-" />
          </>
        ) : (
          partner.warehouses.map((warehouse) => (
            <Fragment key={warehouse.id}>
              <DetailItem
                label="Associated warehouse"
                value={formatDeliveryWarehouseName(warehouse)}
                wide
              />
              <DetailItem
                label="Association date"
                value={formatDeliveryDate(warehouse.associatedAt)}
              />
            </Fragment>
          ))
        )}
      </div>
      <div className="deliveryPartnerWarehouses">
        <div className="sectionTitleRow">
          <h3>Warehouses</h3>
        </div>
        {partner.warehouses.length === 0 ? (
          <p className="deliveryNotice">
            <AlertTriangle aria-hidden size={16} />
            <span>Assign at least one warehouse before dispatching orders to this partner.</span>
          </p>
        ) : (
          <DeliveryWarehouseList warehouses={partner.warehouses} />
        )}
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
  const { isOverflowing, shellRef } = useTableOverflow(assignments.length > 0);

  if (assignments.length === 0) {
    return (
      <EmptyState
        body="No delivery assignments match the selected filters."
        title="No delivery assignments found"
      />
    );
  }

  return (
    <div
      className="deliveryTableShell deliveryAssignmentTableShell"
      data-overflowing={isOverflowing ? "true" : undefined}
      ref={shellRef}
    >
      {isOverflowing ? (
        <p className="deliveryTableHint" id="delivery-assignment-table-hint">
          Swipe sideways to view every assignment column.
        </p>
      ) : null}
      <div className="resourceTable deliveryAssignmentDataTable">
        <Table
          aria-describedby="delivery-assignment-table-hint"
          aria-label="Delivery assignments"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pickup location</TableHead>
              <TableHead>Timeline</TableHead>
              <TableHead>Proof / issue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="deliveryOrderCell">
                  <strong>{assignment.orderNumber}</strong>
                  <em title={assignment.orderId}>{assignment.orderId}</em>
                </TableCell>
                <TableCell className="deliveryAssigneeCell" data-label="Partner">
                  <strong>{assignment.deliveryPartner?.fullName ?? "Unassigned"}</strong>
                  <em>{assignment.deliveryPartner?.mobileNumber ?? assignment.deliveryPartnerId}</em>
                  {typeof assignment.earning === "number" ? (
                    <em>Earned {formatCurrency(assignment.earning)}</em>
                  ) : null}
                </TableCell>
                <TableCell className="deliveryStatusCell">
                  <StatusBadge status={assignment.status} />
                </TableCell>
                <TableCell className="deliveryPickupCell" data-label="Pickup location">
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
                </TableCell>
                <TableCell className="deliveryTimelineCell" data-label="Timeline">
                  <AssignmentTimeline assignment={assignment} />
                </TableCell>
                <TableCell className="deliveryProofCell" data-label="Proof / issue">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
  activePartnerCount,
  assignableOrders,
  canManagePartners,
  error,
  isPending,
  onChange,
  onValidationReset,
  onSubmit,
  partners,
  pickupWarehouse,
  showEmptyStates,
  values,
  warehouses
}: {
  activePartnerCount: number;
  assignableOrders: AdminOrder[];
  canManagePartners: boolean;
  error: string | null;
  isPending: boolean;
  onChange: (values: AssignDeliveryValues) => void;
  onValidationReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Active partners assigned to the pickup warehouse, or every active partner when it is unknown. */
  partners: AdminDeliveryPartner[];
  pickupWarehouse: { id: string; name: string } | null;
  showEmptyStates: boolean;
  values: AssignDeliveryValues;
  warehouses: WarehouseListResponse["items"];
}) {
  const canSubmit =
    !isPending &&
    assignableOrders.length > 0 &&
    partners.length > 0 &&
    Boolean(values.orderId) &&
    Boolean(values.deliveryPartnerId);

  return (
    <form className="formStack deliveryAssignmentForm" onSubmit={onSubmit}>
      <div className="formGrid deliveryAssignmentFormGrid">
        {/* Selects already carry an aria-label, so the visible caption is hidden from assistive tech. */}
        <div className="deliveryField">
          <span aria-hidden="true">Order</span>
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
        </div>
        <div className="deliveryField">
          <span aria-hidden="true">Delivery partner</span>
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
              {partners.map((partner) => (
                <SelectItem key={partner.id} value={partner.id}>
                  {partner.fullName} ({partner.mobileNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pickupWarehouse ? (
            <span className="deliveryFieldHint">
              Showing partners assigned to {pickupWarehouse.name}.
            </span>
          ) : null}
        </div>
        <div className="deliveryField">
          <span aria-hidden="true">Pickup warehouse</span>
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
        </div>
        <label className="deliveryField">
          <span>Pickup instructions</span>
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
      {showEmptyStates && activePartnerCount === 0 ? (
        <EmptyState
          body="No active delivery partners are available for assignment."
          title="No active partners"
        />
      ) : null}
      {showEmptyStates && activePartnerCount > 0 && partners.length === 0 && pickupWarehouse ? (
        <EmptyState
          action={
            canManagePartners ? (
              <Button asChild className="iconTextButton" variant="outline">
                <Link
                  href={`/delivery/partners/new?warehouseId=${encodeURIComponent(pickupWarehouse.id)}`}
                >
                  <UserPlus aria-hidden size={16} />
                  <span>Add partner</span>
                </Link>
              </Button>
            ) : undefined
          }
          body={`No active delivery partner is assigned to ${pickupWarehouse.name}. Choose another pickup warehouse, or assign a partner to this warehouse first.`}
          title="No partners for this warehouse"
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
  value,
  wide = false
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="detailItem" data-wide={wide ? "true" : undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** Names the pickup warehouse from the warehouse list, falling back to the order's own warehouse. */
function getAssignmentWarehouseName(
  warehouseId: string | null,
  warehouses: WarehouseListResponse["items"],
  order: AdminOrder | null
) {
  const warehouse =
    warehouses.find((item) => item.id === warehouseId) ??
    (order?.warehouse?.id === warehouseId ? order?.warehouse : null);

  return warehouse ? formatDeliveryWarehouseName(warehouse) : "this warehouse";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
