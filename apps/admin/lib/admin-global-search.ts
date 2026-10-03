import type { AdminApiRequestOptions, QueryParams } from "./admin-api";
import type { AdminBrand, AdminCategory } from "./catalog-management";
import type { AdminCustomer } from "./customer-management";
import type { AdminDeliveryChargeRule } from "./delivery-charge-management";
import type {
  AdminDeliveryAssignment,
  AdminDeliveryPartner
} from "./delivery-management";
import type { InventoryStock } from "./inventory-management";
import { getVisibleNavigationItems } from "./navigation";
import type { AdminOrder } from "./order-management";
import { ADMIN_PERMISSION as P, hasPermission } from "./permissions";
import type { AdminProduct } from "./product-form";
import type { AdminRole, AdminUser } from "./settings-management";
import type {
  AdminCoupon,
  AdminProductFeedback,
  AdminQuoteRequest
} from "./support-management";
import { buildWarehouseDetailPath, type AdminWarehouse } from "./warehouse-management";

export type AdminSearchResult = {
  id: string;
  title: string;
  description: string;
  href: string;
  group: string;
};

type SearchApi = {
  request<T>(path: string, options?: AdminApiRequestOptions): Promise<T>;
};

type Page = { title: string; href: string; permission: string; keywords?: string };
type PageResponse<T> = {
  items: T[];
  pagination?: { hasNextPage?: boolean; total?: number };
};
type SourceResult = {
  results: AdminSearchResult[];
  unavailable: string[];
  limitations?: string[];
};
type Source = { group: string; run: () => Promise<SourceResult> };

const RESULT_LIMIT = 5;
const SCAN_LIMIT = 100;
const ARRAY_SCAN_LIMIT = 1_000;
const REQUEST_TIMEOUT_MS = 10_000;

// These are existing routes which are not all represented by sidebar children.
const additionalPages: readonly Page[] = [
  { title: "Create product", href: "/products/create", permission: P.ProductsCreate },
  {
    title: "Create category",
    href: "/categories/create",
    permission: P.ProductsCreate
  },
  { title: "Create brand", href: "/brands/create", permission: P.ProductsCreate },
  {
    title: "Product reviews",
    href: "/product-feedback/reviews",
    permission: P.ProductsRead,
    keywords: "feedback moderation ratings"
  },
  {
    title: "Product questions",
    href: "/product-feedback/questions",
    permission: P.ProductsRead,
    keywords: "feedback answers support"
  },
  {
    title: "Order list",
    href: "/orders/list",
    permission: P.OrdersRead,
    keywords: "purchases payments invoices"
  },
  {
    title: "Return requests",
    href: "/returns-refunds/requests",
    permission: P.OrdersRead,
    keywords: "refunds"
  },
  {
    title: "Customer list",
    href: "/customers/list",
    permission: P.UsersRead,
    keywords: "users business contacts"
  },
  {
    title: "Create warehouse",
    href: "/warehouses/create",
    permission: P.WarehouseManage
  },
  {
    title: "Delivery partners",
    href: "/delivery/partners",
    permission: P.DeliveryRead,
    keywords: "drivers applications"
  },
  {
    title: "Delivery assignments",
    href: "/delivery/assignments",
    permission: P.DeliveryRead,
    keywords: "shipments dispatch"
  },
  { title: "Assign delivery", href: "/delivery/assign", permission: P.DeliveryAssign },
  {
    title: "Quote request list",
    href: "/quote-requests/requests",
    permission: P.SettingsManage,
    keywords: "quotation bulk inquiry"
  },
  {
    title: "Coupon list",
    href: "/coupons/list",
    permission: P.SettingsManage,
    keywords: "discount promotion"
  },
  { title: "Create coupon", href: "/coupons/new", permission: P.SettingsManage },
  {
    title: "Create delivery charge",
    href: "/delivery-charges/new",
    permission: P.SettingsManage,
    keywords: "shipping fee"
  },
  {
    title: "Sales reports",
    href: "/reports/sales",
    permission: P.ReportsRead,
    keywords: "revenue analytics"
  },
  { title: "Order reports", href: "/reports/orders", permission: P.ReportsRead },
  { title: "Product reports", href: "/reports/products", permission: P.ReportsRead },
  {
    title: "Inventory reports",
    href: "/reports/inventory",
    permission: P.ReportsRead,
    keywords: "stock"
  },
  {
    title: "Warehouse reports",
    href: "/reports/warehouses",
    permission: P.ReportsRead
  },
  {
    title: "Admin users",
    href: "/settings/admin-users",
    permission: P.SettingsManage,
    keywords: "settings staff team accounts"
  },
  {
    title: "Roles and permissions",
    href: "/settings/roles",
    permission: P.SettingsManage,
    keywords: "settings access"
  }
];

export function getAdminSearchPages(
  query: string,
  permissions: readonly string[]
): AdminSearchResult[] {
  const pages: Array<{ title: string; href: string; keywords: string }> =
    getVisibleNavigationItems(permissions)
      .filter(
        (item) =>
          item.href !== "/dashboard" || hasPermission(permissions, P.ReportsRead)
      )
      .flatMap((item) => [
        { title: item.label, href: item.href, keywords: item.category },
        ...(item.children ?? []).map((child) => ({
          title: `${item.label}: ${child.label}`,
          href: child.href,
          keywords: item.category
        }))
      ]);
  pages.push(
    ...additionalPages
      .filter((page) => {
        if (!hasPermission(permissions, page.permission)) return false;
        // Creation/action routes also sit inside their module's read guard.
        if (/^\/(products|categories|brands)\//.test(page.href))
          return hasPermission(permissions, P.ProductsRead);
        if (page.href === "/warehouses/create")
          return hasPermission(permissions, P.WarehouseRead);
        if (page.href === "/delivery/assign")
          return hasPermission(permissions, P.DeliveryRead);
        return true;
      })
      .map((page) => ({
        ...page,
        keywords: page.keywords ?? ""
      }))
  );

  const unique = new Map<string, AdminSearchResult>();
  for (const page of pages) {
    if (!matches(query, page.title, page.href, page.keywords)) continue;
    unique.set(page.href, {
      id: `page:${page.href}`,
      title: page.title,
      description: "Open admin page",
      href: page.href,
      group: "Pages"
    });
  }
  return [...unique.values()].sort(
    (a, b) => relevance(a.title, query) - relevance(b.title, query)
  );
}

/** Search existing authorized APIs without downloading entire paginated tables. */
export async function searchAdmin(
  api: SearchApi,
  query: string,
  permissions: readonly string[],
  signal?: AbortSignal
): Promise<SourceResult> {
  throwIfAborted(signal);
  const text = query.trim().replace(/\s+/g, " ").slice(0, 100);
  const pages = getAdminSearchPages(text, permissions);
  if (text.length < 2) return { results: pages, unavailable: [], limitations: [] };

  const sources: Source[] = [];
  const add = (permission: string, group: string, run: Source["run"]) => {
    if (hasPermission(permissions, permission)) sources.push({ group, run });
  };
  const paginated = async <T>(
    path: string,
    group: string,
    params: QueryParams,
    render: (item: T) => AdminSearchResult,
    localMatch?: (item: T) => boolean
  ): Promise<SourceResult> => {
    throwIfAborted(signal);
    const response = await api.request<PageResponse<T>>(path, {
      query: { page: 1, limit: localMatch ? SCAN_LIMIT : RESULT_LIMIT, ...params },
      signal,
      timeoutMs: REQUEST_TIMEOUT_MS
    });
    throwIfAborted(signal);
    const incomplete =
      localMatch &&
      (response.pagination?.hasNextPage ||
        (response.pagination?.total ?? 0) > SCAN_LIMIT ||
        (!response.pagination && response.items.length >= SCAN_LIMIT));
    return {
      results: response.items
        .filter((item) => !localMatch || localMatch(item))
        .slice(0, RESULT_LIMIT)
        .map(render),
      unavailable: [],
      limitations: incomplete
        ? [
            `${group}: only the latest ${SCAN_LIMIT} records were searched; open the section to browse older records.`
          ]
        : []
    };
  };
  const array = async <T>(
    path: string,
    group: string,
    render: (item: T) => AdminSearchResult,
    localMatch: (item: T) => boolean,
    flatten?: (items: T[]) => T[]
  ): Promise<SourceResult> => {
    const response = await api.request<T[]>(path, {
      signal,
      timeoutMs: REQUEST_TIMEOUT_MS
    });
    throwIfAborted(signal);
    const items = flatten ? flatten(response) : response;
    return {
      results: items
        .slice(0, ARRAY_SCAN_LIMIT)
        .filter(localMatch)
        .slice(0, RESULT_LIMIT)
        .map(render),
      unavailable: [],
      limitations:
        items.length > ARRAY_SCAN_LIMIT
          ? [`${group}: only the first ${ARRAY_SCAN_LIMIT} records were searched.`]
          : []
    };
  };

  add(P.ProductsRead, "Products", () =>
    paginated<AdminProduct>("/admin/products", "Products", { search: text }, (item) =>
      result(
        "Products",
        item.id,
        item.name,
        `${item.sku} · ${label(item.status)}`,
        `/products/${encodeURIComponent(item.id)}/edit`
      )
    )
  );
  add(P.ProductsRead, "Categories", () =>
    array<AdminCategory>(
      "/admin/categories",
      "Categories",
      (item) =>
        result(
          "Categories",
          item.id,
          item.name,
          item.slug,
          `/categories/${encodeURIComponent(item.id)}/edit`
        ),
      (item) => matches(text, item.name, item.slug, item.description),
      flattenCategories
    )
  );
  add(P.ProductsRead, "Brands", () =>
    array<AdminBrand>(
      "/admin/brands",
      "Brands",
      (item) =>
        result(
          "Brands",
          item.id,
          item.name,
          item.slug,
          `/brands/${encodeURIComponent(item.id)}/edit`
        ),
      (item) => matches(text, item.name, item.slug, item.description)
    )
  );
  add(P.UsersRead, "Customers", () =>
    paginated<AdminCustomer>(
      "/admin/customers",
      "Customers",
      { search: text },
      (item) =>
        result(
          "Customers",
          item.id,
          item.name,
          join(item.mobileNumber, item.email, item.businessName),
          `/customers/${encodeURIComponent(item.id)}`
        )
    )
  );

  const orderResult = (group: string) => (item: AdminOrder) =>
    result(
      group,
      item.id,
      item.orderNumber,
      join(item.customer?.firstName, item.customer?.lastName, label(item.status)),
      `/orders/${encodeURIComponent(item.id)}`
    );
  const orderParams: QueryParams[] = [{ orderNumber: text }];
  if (/^\+?[\d\s()-]+$/.test(text))
    orderParams.push({ customerMobile: text.replace(/[\s()-]/g, "") });
  for (const params of orderParams) {
    add(P.OrdersRead, "Orders", () =>
      paginated<AdminOrder>("/admin/orders", "Orders", params, orderResult("Orders"))
    );
    add(P.OrdersRead, "Returns & refunds", () =>
      paginated<AdminOrder>(
        "/admin/returns-refunds",
        "Returns & refunds",
        params,
        orderResult("Returns & refunds")
      )
    );
  }

  add(P.WarehouseRead, "Warehouses", () =>
    paginated<AdminWarehouse>(
      "/admin/warehouses",
      "Warehouses",
      { search: text },
      (item) =>
        result(
          "Warehouses",
          item.id,
          item.name,
          join(item.code, item.city, item.state),
          buildWarehouseDetailPath(item.id)
        )
    )
  );
  add(P.InventoryRead, "Inventory", async () => {
    const response = await paginated<InventoryStock>(
      "/admin/inventory",
      "Inventory",
      { search: text },
      (item) =>
        result(
          "Inventory",
          item.id,
          `Product ${item.productId}`,
          `${item.availableQuantity} available · ${item.reservedQuantity} reserved · threshold ${item.lowStockThreshold}`,
          url("/inventory", {
            productId: item.productId,
            warehouseId: item.warehouseId
          })
        )
    );
    if (hasPermission(permissions, P.ProductsRead)) {
      // Stock responses contain IDs only; resolve real product names for the
      // five visible matches, keeping every request behind products.read.
      const names = new Map<string, Promise<string>>();
      await Promise.all(
        response.results.map(async (item) => {
          const productId = new URL(item.href, "http://admin.local").searchParams.get(
            "productId"
          );
          if (!productId) return;
          if (!names.has(productId)) {
            names.set(
              productId,
              api
                .request<AdminProduct>(
                  `/admin/products/${encodeURIComponent(productId)}`,
                  { signal, timeoutMs: REQUEST_TIMEOUT_MS }
                )
                .then((product) => product.name)
            );
          }
          item.title =
            (await names.get(productId)?.catch(() => item.title)) ?? item.title;
        })
      );
      throwIfAborted(signal);
    }
    return response;
  });

  add(P.SettingsManage, "Coupons", () =>
    paginated<AdminCoupon>("/admin/coupons", "Coupons", { search: text }, (item) =>
      result(
        "Coupons",
        item.id,
        item.code,
        `${item.isActive ? "Active" : "Inactive"} · Open coupon list`,
        "/coupons/list"
      )
    )
  );
  add(P.SettingsManage, "Delivery charges", () =>
    paginated<AdminDeliveryChargeRule>(
      "/admin/delivery-charge-rules",
      "Delivery charges",
      /^\d{6}$/.test(text) ? { pincode: text } : { search: text },
      (item) =>
        result(
          "Delivery charges",
          item.id,
          item.name,
          join(item.pincode, `₹${item.charge}`, "Open rules list"),
          "/delivery-charges/rules"
        )
    )
  );
  add(P.SettingsManage, "Admin users", () =>
    paginated<AdminUser>(
      "/admin/admin-users",
      "Admin users",
      { search: text },
      (item) =>
        result(
          "Admin users",
          item.id,
          [item.firstName, item.lastName].filter(Boolean).join(" "),
          join(item.email, item.role.name, "Open admin user list"),
          "/settings/admin-users"
        )
    )
  );
  add(P.SettingsManage, "Roles", () =>
    array<AdminRole>(
      "/admin/roles",
      "Roles",
      (item) =>
        result(
          "Roles",
          item.id,
          item.name,
          join(item.code, "Open roles and permissions"),
          "/settings/roles"
        ),
      (item) =>
        matches(
          text,
          item.name,
          item.code,
          item.description,
          ...item.permissions.map(
            (permission) => `${permission.name} ${permission.code}`
          )
        )
    )
  );

  // These deployed lists have no general search parameter. Keep a bounded scan
  // and disclose incomplete coverage instead of reporting a false empty result.
  add(P.SettingsManage, "Quote requests", () =>
    paginated<AdminQuoteRequest>(
      "/admin/quote-requests",
      "Quote requests",
      {},
      (item) =>
        result(
          "Quote requests",
          item.id,
          item.name,
          join(item.organization, item.email, label(item.status)),
          `/quote-requests/${encodeURIComponent(item.id)}`
        ),
      (item) =>
        matches(
          text,
          item.id,
          item.name,
          item.organization,
          item.email,
          item.mobileNumber,
          item.message
        )
    )
  );
  add(P.DeliveryRead, "Delivery partners", () =>
    paginated<AdminDeliveryPartner>(
      "/admin/delivery-partners",
      "Delivery partners",
      {},
      (item) =>
        result(
          "Delivery partners",
          item.id,
          item.fullName,
          join(item.mobileNumber, item.vehicleNumber, label(item.status)),
          `/delivery/partners/${encodeURIComponent(item.id)}`
        ),
      (item) =>
        matches(
          text,
          item.id,
          item.fullName,
          item.email,
          item.mobileNumber,
          item.vehicleNumber
        )
    )
  );
  add(P.DeliveryRead, "Delivery assignments", () =>
    paginated<AdminDeliveryAssignment>(
      "/admin/delivery/assignments",
      "Delivery assignments",
      { search: text },
      (item) =>
        result(
          "Delivery assignments",
          item.id,
          item.orderNumber,
          join(item.deliveryPartner?.fullName, label(item.status)),
          hasPermission(permissions, P.OrdersRead)
            ? `/orders/${encodeURIComponent(item.orderId)}`
            : "/delivery/assignments"
        )
    )
  );
  add(P.ProductsRead, "Product feedback", () =>
    paginated<AdminProductFeedback>(
      "/admin/product-feedback",
      "Product feedback",
      { productSearch: text },
      (item) =>
        result(
          "Product feedback",
          item.id,
          item.productName,
          join(
            item.customerName,
            item.question ?? item.title ?? item.comment,
            "Open feedback list"
          ),
          item.type === "QUESTION"
            ? "/product-feedback/questions"
            : "/product-feedback/reviews"
        )
    )
  );

  const completed = await Promise.allSettled(sources.map((source) => source.run()));
  throwIfAborted(signal);
  const results = [...pages];
  const unavailable: string[] = [];
  const limitations: string[] = [];
  completed.forEach((entry, index) => {
    if (entry.status === "fulfilled") {
      results.push(...entry.value.results);
      unavailable.push(...entry.value.unavailable);
      limitations.push(...(entry.value.limitations ?? []));
    } else {
      unavailable.push(
        `${sources[index]?.group ?? "Some results"}: temporarily unavailable.`
      );
    }
  });
  const seen = new Set<string>();
  const groupCounts = new Map<string, number>();
  return {
    results: results.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      const count = groupCounts.get(item.group) ?? 0;
      if (item.group !== "Pages" && count >= RESULT_LIMIT) return false;
      groupCounts.set(item.group, count + 1);
      return true;
    }),
    unavailable: [...new Set(unavailable)],
    limitations: [...new Set(limitations)]
  };
}

function result(
  group: string,
  id: string,
  title: string,
  description: string,
  href: string
): AdminSearchResult {
  return { id: `${group}:${id}`, title, description, href, group };
}

function matches(query: string, ...values: Array<string | null | undefined>) {
  const haystack = values.filter(Boolean).join(" ").toLocaleLowerCase();
  return query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}

function relevance(title: string, query: string) {
  const text = title.toLocaleLowerCase();
  const term = query.trim().toLocaleLowerCase();
  return text === term ? 0 : text.startsWith(term) ? 1 : 2;
}

function join(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" · ");
}

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function url(path: string, query: Record<string, string>) {
  return `${path}?${new URLSearchParams(query).toString()}`;
}

function flattenCategories(items: AdminCategory[]): AdminCategory[] {
  const results: AdminCategory[] = [];
  const seen = new Set<string>();
  const pending = [...items];
  while (pending.length && results.length <= ARRAY_SCAN_LIMIT) {
    const item = pending.shift();
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    results.push(item);
    pending.push(...(item.children ?? []));
  }
  return results;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Search cancelled.", "AbortError");
}
