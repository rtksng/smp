import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider } from "@heroui/system";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersLandingPage } from "./orders/_components/order-sections";
import { ProductManagementPage } from "./products/product-management";
import {
  ProductReviewsPage,
  ProductQuestionsPage
} from "./product-feedback/_components/product-feedback-sections";
import { DeliveryBulkAssignment } from "./delivery/_components/delivery-bulk-assignment";
import type { AdminOrder } from "@/lib/order-management";
import type { AdminDeliveryPartner } from "@/lib/delivery-management";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  requestResponse: vi.fn(),
  permissions: true
}));
vi.mock("@/lib/admin-session", () => ({
  useAdminSession: () => ({ api: mocks, hasPermission: () => mocks.permissions }),
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("./admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
    "aria-label": label
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    "aria-label"?: string;
  }) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Select</option>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null
}));

const clients: QueryClient[] = [];
function mount(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  clients.push(client);
  return render(
    <HeroUIProvider disableAnimation>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </HeroUIProvider>
  );
}
function paginated<T>(items: T[], page = 1, limit = 20) {
  return {
    items: items.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
      hasNextPage: page * limit < items.length,
      hasPreviousPage: page > 1
    }
  };
}
function makeOrder(id: string, status = "CREATED") {
  return {
    id,
    orderNumber: `QA-${id}`,
    status,
    paymentStatus: "PENDING",
    createdAt: "2026-09-05T10:00:00Z",
    placedAt: null,
    warehouseId: "w1",
    warehouse: { id: "w1", name: "QA warehouse" },
    customer: { firstName: "QA", lastName: "Tester", mobileNumber: "9000000000" },
    totals: { grandTotal: 100 },
    invoice: null
  };
}
function chooseAction(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Bulk action" }), {
    target: { value }
  });
}
async function process(count: number) {
  fireEvent.click(screen.getByRole("button", { name: "Review selected" }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: `Process ${count} ${count === 1 ? "record" : "records"}`
    })
  );
  await screen.findByRole("heading", { name: "Processing results" });
}
beforeEach(() => {
  mocks.permissions = true;
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.resetAllMocks();
});

describe("bulk flows through admin pages and API contracts", () => {
  it("selects filtered orders across pages, reviews them, confirms once, and refreshes the list", async () => {
    const orders = Array.from({ length: 21 }, (_, i) => makeOrder(String(i + 1)));
    orders[20]!.status = "CANCELLED";
    mocks.request.mockImplementation(async (path, init) => {
      if (path === "/admin/orders")
        return paginated(
          orders.map((order) => ({ ...order })),
          init.query.page,
          init.query.limit
        );
      if (path === "/admin/warehouses") return paginated([]);
      const id = path.split("/")[3];
      const order = orders.find((item) => item.id === id)!;
      if (init?.method === "PATCH") order.status = JSON.parse(init.body).status;
      return { ...order };
    });
    mount(<OrdersLandingPage />);
    await screen.findByText("QA-1");
    fireEvent.click(screen.getByRole("button", { name: "Select all 21 filtered" }));
    await screen.findByText("21 selected");
    chooseAction("CONFIRMED");
    fireEvent.click(screen.getByRole("button", { name: "Review selected" }));
    expect(await screen.findByText("20 ready to process")).toBeInTheDocument();
    expect(mocks.request.mock.calls.filter(([, init]) => init?.method)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Process 20 records" }));
    await screen.findByRole("heading", { name: "Processing results" });
    expect(
      mocks.request.mock.calls.filter(([, init]) => init?.method === "PATCH")
    ).toHaveLength(20);
    expect(orders.filter((order) => order.status === "CONFIRMED")).toHaveLength(20);
    expect(orders[20]!.status).toBe("CANCELLED");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Processing results" })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View last results" }));
    expect(
      await screen.findByRole("heading", { name: "Processing results" })
    ).toBeInTheDocument();
  }, 15000);

  it("deactivates selected products, skips those already inactive, and preserves unrelated fields", async () => {
    const products = ["ACTIVE", "INACTIVE"].map((status, i) => ({
      id: `p${i}`,
      name: `QA product ${i}`,
      sku: `QA-${i}`,
      status,
      brand: { name: "QA brand" },
      category: { name: "QA category" },
      sellingPrice: 10
    }));
    mocks.request.mockImplementation(async (path, init) => {
      if (path === "/admin/products")
        return paginated(products.map((item) => ({ ...item })));
      if (path === "/brands" || path === "/categories") return [];
      const product = products.find((item) => path.endsWith(item.id))!;
      if (init?.method === "PATCH") Object.assign(product, JSON.parse(init.body));
      return { ...product };
    });
    mount(<ProductManagementPage view="list" />);
    await screen.findByText("QA product 0");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select current page" }));
    chooseAction("INACTIVE");
    await process(1);
    expect(products.map((item) => item.status)).toEqual(["INACTIVE", "INACTIVE"]);
    expect(products.map((item) => item.sellingPrice)).toEqual([10, 10]);
    expect(mocks.request.mock.calls.filter(([, init]) => init?.method)).toEqual([
      ["/admin/products/p0", { method: "PATCH", body: '{"status":"INACTIVE"}' }]
    ]);
  });

  it("publishes reviews, surfaces one failure, and retries only that failed record", async () => {
    const feedback = ["r1", "r2", "r3"].map((id) => ({
      id,
      type: "REVIEW",
      status: id === "r3" ? "PUBLISHED" : "PENDING_REVIEW",
      customerName: id,
      productName: "QA product",
      productId: "p1",
      title: `QA ${id}`,
      rating: 5,
      createdAt: "2026-09-05T10:00:00Z"
    }));
    let fail = true;
    mocks.request.mockImplementation(async (path, init) => {
      if (path === "/admin/product-feedback")
        return paginated(feedback.map((item) => ({ ...item })));
      const item = feedback.find((row) => path.includes(row.id))!;
      if (item.id === "r2" && fail) throw new Error("Temporary service failure");
      item.status = JSON.parse(init.body).status;
      return { ...item };
    });
    mount(<ProductReviewsPage />);
    await screen.findByText("r1");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select current page" }));
    chooseAction("PUBLISHED");
    await process(2);
    expect(await screen.findByText("Temporary service failure")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Review failed records" }));
    fireEvent.click(await screen.findByRole("button", { name: "Process 1 record" }));
    await screen.findByRole("heading", { name: "Processing results" });
    expect(feedback.every((item) => item.status === "PUBLISHED")).toBe(true);
    expect(
      mocks.request.mock.calls.filter(
        ([path, init]) => path.includes("r1/moderation") && init?.method
      )
    ).toHaveLength(1);
    expect(
      mocks.request.mock.calls.filter(
        ([path, init]) => path.includes("r2/moderation") && init?.method
      )
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Processing results" })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select r3 QA product" })
    ).toBeChecked();
  });

  it("hides selected questions without changing their answers", async () => {
    const question = {
      id: "q1",
      type: "QUESTION",
      status: "ANSWERED",
      customerName: "QA customer",
      productName: "QA product",
      productId: "p1",
      question: "QA question?",
      answer: "Existing answer",
      createdAt: "2026-09-05T10:00:00Z"
    };
    mocks.request.mockImplementation(async (path, init) => {
      if (path === "/admin/product-feedback") return paginated([{ ...question }]);
      question.status = JSON.parse(init.body).status;
      return { ...question };
    });
    mount(<ProductQuestionsPage />);
    await screen.findByText("QA question?");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select current page" }));
    chooseAction("HIDDEN");
    await process(1);
    expect(question.status).toBe("HIDDEN");
    expect(question.answer).toBe("Existing answer");
  });

  it("requires a partner, assigns selected ready orders, and refreshes delivery data", async () => {
    const orders = [makeOrder("1", "PACKED"), makeOrder("2", "CONFIRMED")];
    mocks.request.mockImplementation(async (path, init) => {
      if (path === "/admin/delivery/assign") {
        const body = JSON.parse(init.body);
        orders.find((order) => order.id === body.orderId)!.status = "ASSIGNED";
        return { id: body.orderId };
      }
      return { ...orders.find((order) => path.endsWith(order.id))! };
    });
    const refreshed = vi.fn(async () => undefined);
    mount(
      <DeliveryBulkAssignment
        orders={orders as AdminOrder[]}
        partners={[
          {
            id: "d1",
            fullName: "QA partner",
            mobileNumber: "9000000000",
            status: "ACTIVE"
          } as AdminDeliveryPartner
        ]}
        warehouses={[]}
        disabled={false}
        onComplete={refreshed}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select current page" }));
    chooseAction("assign");
    expect(screen.getByRole("button", { name: "Review selected" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Bulk delivery partner" }), {
      target: { value: "d1" }
    });
    await process(2);
    expect(orders.every((order) => order.status === "ASSIGNED")).toBe(true);
    expect(refreshed).toHaveBeenCalledOnce();
    expect(
      mocks.request.mock.calls.filter(([path]) => path === "/admin/delivery/assign")
    ).toHaveLength(2);
  });

  it("does not expose product write selection to a read-only admin", async () => {
    mocks.permissions = false;
    mocks.request.mockImplementation(async (path) =>
      path === "/admin/products" ? paginated([]) : []
    );
    mount(<ProductManagementPage view="list" />);
    await screen.findByText("No products match the selected filters.");
    expect(
      screen.queryByRole("checkbox", { name: "Select current page" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bulk actions")).not.toBeInTheDocument();
  });
});
