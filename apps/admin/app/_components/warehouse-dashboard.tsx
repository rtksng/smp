"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  PackagePlus,
  RefreshCw,
  Truck,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import styles from "./warehouse-dashboard.module.css";
import { useAdminSession } from "../../lib/admin-session";
import {
  describeDispatchPayment,
  getDispatchCustomerName
} from "../../lib/delivery-management";
import {
  buildStockActionHref,
  INVENTORY_OVERVIEW_PATH,
  type InventorySummary
} from "../../lib/inventory-management";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  buildWarehouseDashboardQuery,
  formatCount,
  formatRate,
  formatRelativeTime,
  formatWaitingTime,
  pluralize,
  WAREHOUSE_DASHBOARD_RANGES,
  WAREHOUSE_DASHBOARD_REFRESH_MS,
  withWarehouse,
  type WarehouseDashboard as WarehouseDashboardReport,
  type WarehouseDashboardRangeDays
} from "../../lib/warehouse-dashboard";

const ALL_WAREHOUSES_VALUE = "all";
const DELIVERY_ASSIGN_PATH = "/delivery/assign";
const DELIVERY_ASSIGNMENTS_PATH = "/delivery/assignments";
const DELIVERY_PARTNERS_PATH = "/delivery/partners";
const updatedAtFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit"
});

type KpiTone = "neutral" | "primary" | "warning";

/** Which follow-up pages the signed-in admin may open from the dashboard. */
type DashboardAccess = {
  assign: boolean;
  deliveries: boolean;
  inventory: boolean;
  managePartners: boolean;
  restock: boolean;
};

type PanelProps = {
  access: DashboardAccess;
  dashboard: WarehouseDashboardReport;
  /** Rows name their warehouse only while more than one warehouse is in view. */
  showWarehouse: boolean;
  warehouseId: string;
};

/** The dashboard for the warehouse picked in the URL, as linked from a warehouse page. */
export function WarehouseDashboardPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading warehouse dashboard..." />}>
      <WarehouseDashboardFromUrl />
    </Suspense>
  );
}

function WarehouseDashboardFromUrl() {
  const warehouseId = useSearchParams().get("warehouseId") ?? "";

  return <WarehouseDashboard initialWarehouseId={warehouseId} key={warehouseId} />;
}

export function WarehouseDashboard({ initialWarehouseId = "" }: { initialWarehouseId?: string }) {
  const { api, hasPermission, isSuperAdmin } = useAdminSession();
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId);
  const [rangeDays, setRangeDays] = useState<WarehouseDashboardRangeDays>(30);
  // Built on every render so the period moves on by itself after midnight.
  const query = buildWarehouseDashboardQuery(warehouseId, rangeDays);
  const dashboardQuery = useQuery<WarehouseDashboardReport>({
    // Keep the last figures on screen while a refresh or a new filter loads.
    placeholderData: (previous) => previous,
    queryFn: () =>
      api.request<WarehouseDashboardReport>("/admin/reports/warehouse-dashboard", {
        query
      }),
    queryKey: ["admin", "reports", "warehouse-dashboard", query],
    refetchInterval: WAREHOUSE_DASHBOARD_REFRESH_MS
  });
  // Figures held over from another warehouse or period must not sit under an error.
  const dashboard =
    dashboardQuery.isError && dashboardQuery.isPlaceholderData ? undefined : dashboardQuery.data;
  const access: DashboardAccess = {
    assign: hasPermission(ADMIN_PERMISSION.DeliveryAssign),
    deliveries: hasPermission(ADMIN_PERMISSION.DeliveryRead),
    inventory: hasPermission(ADMIN_PERMISSION.InventoryRead),
    managePartners: hasPermission(ADMIN_PERMISSION.DeliveryPartnersManage),
    restock: hasPermission(ADMIN_PERMISSION.InventoryUpdate)
  };
  const allWarehousesLabel = isSuperAdmin ? "All warehouses" : "All my warehouses";
  const warehouseOptions = dashboard?.warehouseOptions ?? [];
  const scopedWarehouse = dashboard?.warehouse ?? null;
  const scopedWarehouseId = scopedWarehouse?.id ?? "";
  const rangeLabel =
    WAREHOUSE_DASHBOARD_RANGES.find((range) => range.days === rangeDays)?.label ?? "Last 30 days";
  const errorMessage =
    dashboardQuery.error instanceof Error
      ? dashboardQuery.error.message
      : "Unable to load the warehouse dashboard.";

  return (
    <div className={styles.dashboard}>
      <section aria-label="Dashboard controls" className={`panel ${styles.header}`}>
        <PageHeader
          actions={
            <div className={styles.controls}>
              {warehouseOptions.length > 1 ? (
                <div className={styles.control}>
                  <Select
                    aria-label="Warehouse"
                    onValueChange={(value) =>
                      setWarehouseId(value === ALL_WAREHOUSES_VALUE ? "" : value)
                    }
                    value={warehouseId || ALL_WAREHOUSES_VALUE}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={allWarehousesLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_WAREHOUSES_VALUE}>{allWarehousesLabel}</SelectItem>
                      {warehouseOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name} ({option.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className={styles.control}>
                <Select
                  aria-label="Fulfilment period"
                  onValueChange={(value) =>
                    setRangeDays(Number(value) as WarehouseDashboardRangeDays)
                  }
                  value={String(rangeDays)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Last 30 days" />
                  </SelectTrigger>
                  <SelectContent>
                    {WAREHOUSE_DASHBOARD_RANGES.map((range) => (
                      <SelectItem key={range.days} value={String(range.days)}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="iconTextButton"
                disabled={dashboardQuery.isFetching}
                onClick={() => void dashboardQuery.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>{dashboardQuery.isFetching ? "Refreshing..." : "Refresh"}</span>
              </Button>
            </div>
          }
          eyebrow="Warehouse operations"
          // A neutral title until the first load says which warehouses are in view.
          title={dashboard ? (scopedWarehouse?.name ?? allWarehousesLabel) : "Warehouse dashboard"}
        />
        {dashboard ? (
          <p className={styles.scopeLine}>
            <span>
              {scopedWarehouse ? (
                <>
                  Showing <strong>{scopedWarehouse.name}</strong> ({scopedWarehouse.code}),{" "}
                  {scopedWarehouse.city} only.
                </>
              ) : (
                <>
                  Showing <strong>{pluralize(warehouseOptions.length, "warehouse")}</strong>{" "}
                  together.
                </>
              )}
            </span>
            <span className={styles.liveStatus}>
              <span
                aria-hidden
                className={styles.liveDot}
                data-state={dashboardQuery.isError ? "stale" : "live"}
              />
              Updated {updatedAtFormatter.format(dashboardQuery.dataUpdatedAt)}. Refreshes every 30
              seconds.
            </span>
          </p>
        ) : null}
      </section>

      {dashboardQuery.isError ? (
        <div className={styles.errorBanner} role="alert">
          <p>
            {dashboard
              ? "Could not refresh the dashboard. The figures below are from the last update."
              : errorMessage}
          </p>
          <div className={styles.errorActions}>
            <Button onClick={() => void dashboardQuery.refetch()} size="sm" type="button" variant="outline">
              Try again
            </Button>
            {warehouseId && !dashboard ? (
              <Button onClick={() => setWarehouseId("")} size="sm" type="button" variant="outline">
                Show {allWarehousesLabel.toLowerCase()}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {dashboardQuery.isLoading ? <LoadingState label="Loading warehouse dashboard..." /> : null}

      {dashboard && warehouseOptions.length === 0 ? (
        isSuperAdmin ? (
          <EmptyState
            body="Create a warehouse to start tracking its stock, dispatches, and riders here."
            title="No warehouses yet"
          />
        ) : (
          <EmptyState
            body="Ask the super admin to add you to a warehouse. Its stock, dispatches, and riders will show here."
            title="You are not assigned to a warehouse"
          />
        )
      ) : null}

      {dashboard && warehouseOptions.length > 0 ? (
        <div
          className={styles.body}
          data-refreshing={dashboardQuery.isPlaceholderData ? "true" : undefined}
        >
          <KpiRow
            access={access}
            dashboard={dashboard}
            rangeLabel={rangeLabel}
            warehouseId={scopedWarehouseId}
          />
          <DispatchPipeline access={access} dashboard={dashboard} warehouseId={scopedWarehouseId} />
          {/* Two independent columns, so a long queue never leaves a gap beside it. */}
          <div className={styles.panelColumns}>
            <div className={styles.panelColumn}>
              <DispatchQueuePanel
                access={access}
                dashboard={dashboard}
                showWarehouse={!scopedWarehouse}
                warehouseId={scopedWarehouseId}
              />
              <ActiveDeliveriesPanel
                access={access}
                dashboard={dashboard}
                showWarehouse={!scopedWarehouse}
                warehouseId={scopedWarehouseId}
              />
              <RidersPanel
                access={access}
                dashboard={dashboard}
                showWarehouse={!scopedWarehouse}
                warehouseId={scopedWarehouseId}
              />
            </div>
            <div className={styles.panelColumn}>
              <RestockPanel
                access={access}
                dashboard={dashboard}
                showWarehouse={!scopedWarehouse}
                warehouseId={scopedWarehouseId}
              />
              <StockHealthPanel
                canOpenInventory={access.inventory}
                stock={dashboard.stock}
                warehouseId={scopedWarehouseId}
              />
              <FulfilmentPanel dashboard={dashboard} rangeLabel={rangeLabel} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KpiRow({
  access,
  dashboard,
  rangeLabel,
  warehouseId
}: {
  access: DashboardAccess;
  dashboard: WarehouseDashboardReport;
  rangeLabel: string;
  warehouseId: string;
}) {
  const { dispatch, fulfillment, riders, stock } = dashboard;
  const oldestWait = formatWaitingTime(dispatch.oldestReadySince);
  const noFreeRider = dispatch.readyToDispatch > 0 && riders.available === 0;
  const closedOrders = fulfillment.delivered + fulfillment.cancelled;
  const period = rangeLabel.toLowerCase();

  return (
    <section aria-label="Key warehouse metrics" className={`dashboardKpiGrid ${styles.kpiGrid}`}>
      <KpiTile
        href={access.inventory ? withWarehouse(INVENTORY_OVERVIEW_PATH, warehouseId) : undefined}
        label="Active stock"
        note={`Units available across ${pluralize(stock.assignedProducts, "product")}`}
        value={formatCount(stock.availableUnits)}
      />
      <KpiTile
        href={access.assign ? withWarehouse(DELIVERY_ASSIGN_PATH, warehouseId) : undefined}
        label="Pending dispatches"
        note={oldestWait ? `Oldest has waited ${oldestWait}` : "Nothing is waiting to go out"}
        tone={dispatch.readyToDispatch > 0 ? "warning" : "neutral"}
        value={formatCount(dispatch.readyToDispatch)}
      />
      <KpiTile
        href={access.deliveries ? DELIVERY_PARTNERS_PATH : undefined}
        label="Assigned riders"
        note={
          noFreeRider
            ? "No free rider is online for the waiting orders"
            : `${formatCount(riders.online)} online, ${formatCount(riders.available)} free`
        }
        tone={noFreeRider ? "warning" : "neutral"}
        value={formatCount(riders.assigned)}
      />
      <KpiTile
        href={access.deliveries ? withWarehouse(DELIVERY_ASSIGNMENTS_PATH, warehouseId) : undefined}
        label="Fulfilment rate"
        note={
          closedOrders > 0
            ? `${formatCount(fulfillment.delivered)} delivered of ${pluralize(closedOrders, "closed order")}, ${period}`
            : `No delivered or cancelled orders, ${period}`
        }
        tone="primary"
        value={formatRate(fulfillment.fulfillmentRate)}
      />
    </section>
  );
}

function KpiTile({
  href,
  label,
  note,
  tone = "neutral",
  value
}: {
  href?: string;
  label: string;
  note: string;
  tone?: KpiTone;
  value: string;
}) {
  const className = `dashboardKpi dashboardKpi--${tone} ${styles.kpi}`;
  const content = (
    <>
      <span>
        {tone === "warning" ? <AlertTriangle aria-hidden size={14} /> : null}
        {label}
      </span>
      <strong>{value}</strong>
      <em>{note}</em>
    </>
  );

  return href ? (
    <Link className={className} href={href}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function DispatchPipeline({
  access,
  dashboard,
  warehouseId
}: {
  access: DashboardAccess;
  dashboard: WarehouseDashboardReport;
  warehouseId: string;
}) {
  const { dispatch } = dashboard;
  const assignmentsHref = (status?: string) =>
    access.deliveries
      ? withWarehouse(DELIVERY_ASSIGNMENTS_PATH, warehouseId, status ? { status } : {})
      : undefined;
  const steps = [
    {
      href: access.assign ? withWarehouse(DELIVERY_ASSIGN_PATH, warehouseId) : undefined,
      label: "Ready to dispatch",
      note: "Confirmed or packed, no rider yet",
      value: dispatch.readyToDispatch
    },
    {
      href: assignmentsHref(),
      label: "Waiting for pickup",
      note: "Rider assigned, not collected",
      value: dispatch.awaitingPickup
    },
    {
      href: assignmentsHref(),
      label: "On the road",
      note: "Picked up or out for delivery",
      value: dispatch.inTransit
    },
    {
      href: assignmentsHref("DELIVERED"),
      label: "Delivered today",
      note: "Handed to the customer",
      value: dispatch.deliveredToday
    }
  ];
  const failedHref = assignmentsHref("FAILED");

  return (
    <section aria-labelledby="warehouse-pipeline-title" className={`panel ${styles.panel}`}>
      <div className={styles.panelHeader}>
        <div>
          <h2 id="warehouse-pipeline-title">Dispatch pipeline</h2>
          <p>Where today&apos;s orders are on their way out of the warehouse.</p>
        </div>
        {dispatch.failedToday > 0 ? (
          <p className={styles.failedNote}>
            <AlertTriangle aria-hidden size={14} />
            {failedHref ? (
              <Link href={failedHref}>
                {pluralize(dispatch.failedToday, "delivery", "deliveries")} failed today
              </Link>
            ) : (
              `${pluralize(dispatch.failedToday, "delivery", "deliveries")} failed today`
            )}
          </p>
        ) : (
          <p className={styles.quietNote}>No failed deliveries today</p>
        )}
      </div>
      <ol className={styles.pipelineSteps}>
        {steps.map((step) => {
          const content = (
            <>
              <span>{step.label}</span>
              <strong>{formatCount(step.value)}</strong>
              <em>{step.note}</em>
            </>
          );

          return (
            <li key={step.label}>
              {step.href ? (
                <Link className={styles.pipelineStep} href={step.href}>
                  {content}
                </Link>
              ) : (
                <div className={styles.pipelineStep}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DispatchQueuePanel({ access, dashboard, showWarehouse, warehouseId }: PanelProps) {
  const orders = dashboard.queues.dispatch;
  const total = dashboard.dispatch.readyToDispatch;

  return (
    <DashboardPanel
      action={
        access.assign && total > 0 ? (
          <PanelLink href={withWarehouse(DELIVERY_ASSIGN_PATH, warehouseId)}>
            Open dispatch queue
          </PanelLink>
        ) : null
      }
      count={total}
      id="warehouse-dispatch-queue"
      summary="Oldest first. Assign a rider to send each order out."
      title="Ready to dispatch"
    >
      {orders.length === 0 ? (
        <p className={styles.emptyNote}>
          Nothing is waiting. Confirmed and packed orders show up here.
        </p>
      ) : (
        <ol className={styles.rows}>
          {orders.map((order) => {
            const waited = formatWaitingTime(order.placedAt ?? order.createdAt);
            const details = [
              describeDispatchPayment(order),
              order.shippingAddress
                ? `${order.shippingAddress.city} ${order.shippingAddress.pincode}`
                : null,
              showWarehouse && order.warehouse ? order.warehouse.name : null
            ].filter(Boolean);

            return (
              <li className={styles.row} key={order.id}>
                <div className={styles.rowMain}>
                  <strong>{order.orderNumber}</strong>
                  <span>
                    {getDispatchCustomerName(order)}, {pluralize(order.itemCount, "item")}
                  </span>
                  <span className={styles.rowMeta}>{details.join(" · ")}</span>
                  {order.attempts > 0 ? (
                    <span className={styles.rowFlag}>
                      <AlertTriangle aria-hidden size={13} />
                      Redelivery: {pluralize(order.attempts, "earlier attempt")} did not complete
                    </span>
                  ) : null}
                </div>
                <div className={styles.rowAside}>
                  <span className={styles.rowStatus}>
                    <StatusBadge status={order.status} />
                    {waited ? (
                      <span className={styles.waiting}>
                        <Clock aria-hidden size={13} />
                        Waiting {waited}
                      </span>
                    ) : null}
                  </span>
                  {access.assign ? (
                    <Button asChild className="iconTextButton" size="sm">
                      <Link
                        aria-label={`Assign a rider to ${order.orderNumber}`}
                        href={withWarehouse(DELIVERY_ASSIGN_PATH, order.warehouseId ?? warehouseId, {
                          orderId: order.id
                        })}
                      >
                        <Truck aria-hidden size={14} />
                        <span>Assign</span>
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {total > orders.length ? (
        <p className={styles.moreNote}>
          Showing the oldest {formatCount(orders.length)} of {formatCount(total)}.
        </p>
      ) : null}
    </DashboardPanel>
  );
}

function ActiveDeliveriesPanel({ access, dashboard, showWarehouse, warehouseId }: PanelProps) {
  const deliveries = dashboard.queues.activeDeliveries;
  const total = dashboard.dispatch.awaitingPickup + dashboard.dispatch.inTransit;

  return (
    <DashboardPanel
      action={
        access.deliveries && total > 0 ? (
          <PanelLink href={withWarehouse(DELIVERY_ASSIGNMENTS_PATH, warehouseId)}>
            Track all deliveries
          </PanelLink>
        ) : null
      }
      count={total}
      id="warehouse-active-deliveries"
      summary="Latest rider updates first."
      title="Deliveries in progress"
    >
      {deliveries.length === 0 ? (
        <p className={styles.emptyNote}>No deliveries are in progress right now.</p>
      ) : (
        <ol className={styles.rows}>
          {deliveries.map((delivery) => (
            <li className={styles.row} key={delivery.id}>
              <div className={styles.rowMain}>
                {access.deliveries ? (
                  <Link
                    className={styles.rowTitleLink}
                    href={withWarehouse(DELIVERY_ASSIGNMENTS_PATH, "", {
                      search: delivery.orderNumber
                    })}
                  >
                    {delivery.orderNumber}
                  </Link>
                ) : (
                  <strong>{delivery.orderNumber}</strong>
                )}
                <span>
                  {delivery.partnerName}, {delivery.partnerMobile}
                </span>
                {showWarehouse && delivery.warehouseName ? (
                  <span className={styles.rowMeta}>From {delivery.warehouseName}</span>
                ) : null}
              </div>
              <div className={styles.rowAside}>
                <span className={styles.rowStatus}>
                  <StatusBadge status={delivery.status} />
                  <span className={styles.rowMeta}>
                    Updated {formatRelativeTime(delivery.updatedAt)}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}

function RestockPanel({ access, dashboard, showWarehouse, warehouseId }: PanelProps) {
  const lines = dashboard.queues.lowStock;
  const total = dashboard.stock.lowStockItems + dashboard.stock.outOfStockItems;

  return (
    <DashboardPanel
      action={
        access.inventory && total > 0 ? (
          <PanelLink href={withWarehouse(INVENTORY_OVERVIEW_PATH, warehouseId, { lowStock: "true" })}>
            See all
          </PanelLink>
        ) : null
      }
      count={total}
      id="warehouse-restock"
      summary="At or below the restock level, emptiest first."
      title="Needs restock"
    >
      {lines.length === 0 ? (
        <p className={styles.emptyNote}>Every product here is above its restock level.</p>
      ) : (
        <ol className={styles.rows}>
          {lines.map((line) => {
            const name = line.variantName
              ? `${line.productName} (${line.variantName})`
              : line.productName;

            return (
              <li className={styles.row} key={line.id}>
                <div className={styles.rowMain}>
                  <strong>{name}</strong>
                  <span className={styles.rowMeta}>
                    {[`SKU ${line.sku}`, showWarehouse ? line.warehouseName : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <div className={styles.rowAside}>
                  <span className={styles.rowStatus}>
                    <StatusBadge status={line.status} />
                    <span className={styles.stockLevel}>
                      {formatCount(line.availableQuantity)} left, restock at{" "}
                      {formatCount(line.lowStockThreshold)}
                    </span>
                  </span>
                  {access.restock ? (
                    <Button asChild className="iconTextButton" size="sm" variant="outline">
                      <Link
                        aria-label={`Receive stock for ${name}`}
                        href={buildStockActionHref("receive", {
                          productId: line.productId,
                          variantId: line.variantId,
                          warehouseId: line.warehouseId
                        })}
                      >
                        <PackagePlus aria-hidden size={14} />
                        <span>Receive</span>
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DashboardPanel>
  );
}

function RidersPanel({ access, dashboard, warehouseId }: PanelProps) {
  const { riders } = dashboard;
  const list = dashboard.queues.riders;

  return (
    <DashboardPanel
      action={
        access.deliveries && riders.assigned > 0 ? (
          <PanelLink href={DELIVERY_PARTNERS_PATH}>All partners</PanelLink>
        ) : null
      }
      count={riders.assigned}
      id="warehouse-riders"
      summary={`${formatCount(riders.online)} online, ${formatCount(riders.onDelivery)} on a delivery, ${formatCount(riders.available)} free to take an order.`}
      title="Riders"
    >
      {list.length === 0 ? (
        <div className={styles.emptyNote}>
          <p>No active delivery partner works from this warehouse yet.</p>
          {access.managePartners ? (
            <Button asChild className="iconTextButton" size="sm" variant="outline">
              <Link href={withWarehouse(`${DELIVERY_PARTNERS_PATH}/new`, warehouseId)}>
                <UserPlus aria-hidden size={14} />
                <span>Add partner</span>
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ol className={styles.rows}>
          {list.map((rider) => (
            <li className={styles.row} key={rider.id}>
              <div className={styles.rowMain}>
                <strong>{rider.fullName}</strong>
                <span className={styles.rowMeta}>
                  {[rider.mobileNumber, rider.vehicleNumber].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className={styles.rowAside}>
                <span className={styles.rowStatus}>
                  <span
                    className={`statusBadge ${rider.isOnline ? "statusBadge--active" : "statusBadge--inactive"}`}
                  >
                    {rider.isOnline ? "Online" : "Offline"}
                  </span>
                  <span className={styles.rowMeta}>{describeRiderActivity(rider)}</span>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}

function StockHealthPanel({
  canOpenInventory,
  stock,
  warehouseId
}: {
  canOpenInventory: boolean;
  stock: InventorySummary;
  warehouseId: string;
}) {
  const levels = [
    {
      label: "In stock",
      params: { stockStatus: "IN_STOCK" },
      tone: "good",
      value: stock.inStockItems
    },
    {
      label: "Low stock",
      params: { stockStatus: "LOW_STOCK" },
      tone: "low",
      value: stock.lowStockItems
    },
    {
      label: "Out of stock",
      params: { stockStatus: "OUT_OF_STOCK" },
      tone: "out",
      value: stock.outOfStockItems
    }
  ];
  const rows = [
    ...levels,
    {
      label: `Batches expiring in ${stock.nearExpiryDays} days`,
      params: { nearExpiry: "true", nearExpiryDays: String(stock.nearExpiryDays) },
      tone: null,
      value: stock.nearExpiryBatches
    }
  ];

  return (
    <DashboardPanel
      id="warehouse-stock-health"
      summary={`${pluralize(stock.trackedItems, "stock line")} for ${pluralize(stock.assignedProducts, "assigned product")}. ${formatCount(stock.reservedUnits)} units are reserved for open orders.`}
      title="Stock health"
    >
      {stock.trackedItems > 0 ? (
        <div
          aria-label={levels.map((level) => `${level.label}: ${formatCount(level.value)}`).join(", ")}
          className={styles.stockBar}
          role="img"
        >
          {levels
            .filter((level) => level.value > 0)
            .map((level) => (
              <span
                className={styles.stockBarSegment}
                data-tone={level.tone}
                key={level.label}
                style={{ flexGrow: level.value }}
              />
            ))}
        </div>
      ) : (
        <p className={styles.emptyNote}>No stock has been received here yet.</p>
      )}
      <dl className={styles.figureList}>
        {rows.map((row) => (
          <div className={styles.figureRow} key={row.label}>
            <dt>
              {row.tone ? (
                <span aria-hidden className={styles.swatch} data-tone={row.tone} />
              ) : null}
              {row.label}
            </dt>
            <dd>
              {canOpenInventory ? (
                <Link
                  aria-label={`${row.label}: ${formatCount(row.value)}. Open in inventory`}
                  href={withWarehouse(INVENTORY_OVERVIEW_PATH, warehouseId, row.params)}
                >
                  {formatCount(row.value)}
                </Link>
              ) : (
                formatCount(row.value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </DashboardPanel>
  );
}

function FulfilmentPanel({
  dashboard,
  rangeLabel
}: {
  dashboard: WarehouseDashboardReport;
  rangeLabel: string;
}) {
  const { fulfillment } = dashboard;
  const rows = [
    { label: "Orders placed", value: fulfillment.ordersPlaced },
    { label: "Delivered", value: fulfillment.delivered },
    { label: "Cancelled", value: fulfillment.cancelled },
    { label: "Still in progress", value: fulfillment.inProgress }
  ];

  return (
    <DashboardPanel
      id="warehouse-fulfilment"
      summary={`Orders placed in the ${rangeLabel.toLowerCase()} and how they ended.`}
      title="Fulfilment"
    >
      <dl className={styles.figureList}>
        {rows.map((row) => (
          <div className={styles.figureRow} key={row.label}>
            <dt>{row.label}</dt>
            <dd>{formatCount(row.value)}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.rateNote}>
        Fulfilment rate <strong>{formatRate(fulfillment.fulfillmentRate)}</strong> is delivered
        orders out of delivered and cancelled ones. Returned orders count as delivered.
      </p>
      <p className={styles.rateNote}>
        Delivery success <strong>{formatRate(fulfillment.deliverySuccessRate)}</strong> across{" "}
        {pluralize(fulfillment.deliveryAttempts, "completed delivery attempt")}.
      </p>
    </DashboardPanel>
  );
}

function DashboardPanel({
  action,
  children,
  count,
  id,
  summary,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  count?: number;
  id: string;
  summary?: string;
  title: string;
}) {
  const titleId = `${id}-title`;

  return (
    <section aria-labelledby={titleId} className={`panel ${styles.panel}`}>
      <div className={styles.panelHeader}>
        <div>
          <h2 id={titleId}>
            {title}
            {count === undefined ? null : <span className={styles.count}>{formatCount(count)}</span>}
          </h2>
          {summary ? <p>{summary}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className={`reportTableLink ${styles.panelLink}`} href={href}>
      {children}
      <ArrowRight aria-hidden size={14} />
    </Link>
  );
}

function describeRiderActivity(rider: WarehouseDashboardReport["queues"]["riders"][number]) {
  if (rider.activeDeliveries > 0) {
    return pluralize(rider.activeDeliveries, "active delivery", "active deliveries");
  }

  if (rider.isOnline) {
    return "Free";
  }

  return rider.lastSeenAt ? `Last seen ${formatRelativeTime(rider.lastSeenAt)}` : "Not seen online yet";
}
