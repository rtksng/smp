"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  RefreshCw,
  Search,
  Truck,
  XCircle
} from "lucide-react";
import Link from "next/link";
import {
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
import type { WarehouseListResponse } from "../../../lib/warehouse-management";
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
} from "../../../lib/delivery-management";

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

type DeliveryView = "overview" | "partners" | "assignments" | "assign";

const deliverySections: Array<{
  description: string;
  href: string;
  id: DeliveryView;
  title: string;
}> = [
  {
    description: "Delivery metrics and shortcuts into focused operation pages.",
    href: "/delivery",
    id: "overview",
    title: "Overview"
  },
  {
    description: "Approve, reject, inspect, and verify delivery partner documents.",
    href: "/delivery/partners",
    id: "partners",
    title: "Partners"
  },
  {
    description: "Track assigned orders, pickup locations, proof, and issues.",
    href: "/delivery/assignments",
    id: "assignments",
    title: "Assignments"
  },
  {
    description: "Assign ready orders to active delivery partners.",
    href: "/delivery/assign",
    id: "assign",
    title: "Assign order"
  }
];

const deliveryCopy: Record<DeliveryView, { summary: string; title: string }> = {
  assign: {
    summary: "Create a delivery assignment from one focused order-to-partner form.",
    title: "Assign delivery"
  },
  assignments: {
    summary: "Filter and inspect delivery assignments in a table-first operations view.",
    title: "Delivery assignments"
  },
  overview: {
    summary: "Review delivery coverage and jump into focused partner, assignment, and dispatch pages.",
    title: "Delivery operations"
  },
  partners: {
    summary: "Search delivery partners, review verification status, and open document details.",
    title: "Delivery partners"
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
  return <DeliveryContent view="overview" />;
}

export function DeliveryPartnersPage() {
  return <DeliveryContent view="partners" />;
}

export function DeliveryPartnerDetailPage({ partnerId }: { partnerId: string }) {
  const { api } = useAdminSession();
  const partnerQuery = useQuery({
    queryFn: () =>
      api.request<AdminDeliveryPartner>(`/admin/delivery-partners/${partnerId}`),
    queryKey: ["admin", "delivery", "partner", partnerId]
  });

  return (
    <section className="panel deliveryPartnerDetailPagePanel">
      <PageHeader
        actions={
          <Button asChild className="buttonLink iconTextButton" variant="outline">
            <Link href="/delivery/partners">
              <ArrowLeft aria-hidden size={16} />
              <span>Back</span>
            </Link>
          </Button>
        }
        className="settingsSectionHeader"
        eyebrow="Partner detail"
        title={partnerQuery.data?.fullName ?? "Delivery partner"}
      />
      <PartnerDetail
        isLoading={partnerQuery.isLoading}
        partner={partnerQuery.data ?? null}
        queryError={partnerQuery.error}
      />
    </section>
  );
}

export function DeliveryAssignmentsPage() {
  return <DeliveryContent view="assignments" />;
}

export function DeliveryAssignPage() {
  return <DeliveryContent view="assign" />;
}

function DeliveryContent({ view }: { view: DeliveryView }) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [partnerPage, setPartnerPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
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
    await Promise.all([
      partnersQuery.refetch(),
      assignmentsQuery.refetch()
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
    <>
      <section className="panel deliveryOverviewPanel">
        <DeliverySectionNav active={view} />
        <PageHeader
          actions={
            <div className="actionRow">
              {view === "overview" ? (
                <Button asChild className="iconTextButton">
                  <Link href="/delivery/partners">
                    <Truck aria-hidden size={16} />
                    <span>Open delivery</span>
                  </Link>
                </Button>
              ) : null}
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

        {view === "overview" ? (
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

      {view === "overview" ? (
        <DeliveryOverviewCharts assignments={assignments} partners={partners} />
      ) : null}

      {view === "partners" ? (
        <section className="panel deliveryPartnersPanel mt-3">
          <PageHeader
            className="settingsSectionHeader"
            eyebrow="Partners"
            level={2}
            summary="Filter partner records, approve verification, and open one profile for document review."
            title="Partner approvals"
          />
          <PartnerFilterForm
            filters={partnerDraftFilters}
            onChange={setPartnerDraftFilters}
            onReset={resetPartnerFilters}
            onSubmit={applyPartnerFilters}
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
              isMutating={isMutating}
              onAction={requestPartnerAction}
              partners={partners}
            />
          ) : null}
          {partnersQuery.data?.pagination ? (
            <SharedPaginationControls
              onChange={setPartnerPage}
              page={partnersQuery.data.pagination.page}
              totalPages={Math.max(partnersQuery.data.pagination.totalPages, 1)}
            />
          ) : null}
        </section>
      ) : null}

      {view === "assignments" ? (
        <section className="panel deliveryAssignmentsPanel mt-3">
          <PageHeader
            className="settingsSectionHeader"
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
      ) : null}

      {view === "assign" ? (
        <PermissionGate permission={ADMIN_PERMISSION.DeliveryAssign}>
          <section className="panel deliveryAssignPanel mt-3">
            <PageHeader
              className="settingsSectionHeader"
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

function DeliverySectionNav({ active }: { active: DeliveryView }) {
  return (
    <nav className="deliverySectionNav" aria-label="Delivery sections">
      {deliverySections.map((section) => (
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
  partners
}: {
  isMutating: boolean;
  onAction: (action: "approve" | "reject", partner: AdminDeliveryPartner) => void;
  partners: AdminDeliveryPartner[];
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
    <div className="resourceTable deliveryPartnerDataTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Partner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead>Documents</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((partner) => (
            <TableRow key={partner.id}>
              <TableCell>
                <strong>{partner.fullName}</strong>
                <em>{partner.mobileNumber}</em>
              </TableCell>
              <TableCell>
                <StatusBadge status={partner.status} />
              </TableCell>
              <TableCell>
                <AvailabilityBadge isOnline={partner.isOnline} />
              </TableCell>
              <TableCell>{partner.documents.length} files</TableCell>
              <TableCell>
                <Button asChild className="iconTextButton" size="sm" variant="outline">
                  <Link href={`/delivery/partners/${partner.id}`}>
                    <Eye aria-hidden size={14} />
                    <span>View</span>
                  </Link>
                </Button>
              </TableCell>
              <TableCell>
                <div className="tableActions">
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
    <div className="resourceTable deliveryAssignmentDataTable">
      <Table>
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
              <TableCell>
                <strong>{assignment.orderNumber}</strong>
                <em>{assignment.orderId}</em>
              </TableCell>
              <TableCell>
                <strong>{assignment.deliveryPartner?.fullName ?? "Unassigned"}</strong>
                <em>{assignment.deliveryPartner?.mobileNumber ?? assignment.deliveryPartnerId}</em>
              </TableCell>
              <TableCell>
                <StatusBadge status={assignment.status} />
              </TableCell>
              <TableCell>
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
              <TableCell>
                <AssignmentTimeline assignment={assignment} />
              </TableCell>
              <TableCell>
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
