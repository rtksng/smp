import { Platform } from "react-native";
import { ApiError } from "./client";
import { requestCustomerApiResponse } from "./customer-client";
import type { Order } from "./schemas";

const invoiceableStatuses = new Set<Order["status"]>([
  "ASSIGNED",
  "CONFIRMED",
  "DELIVERED",
  "OUT_FOR_DELIVERY",
  "PACKED",
  "RETURNED"
]);

export function canDownloadOrderInvoice(order: Order) {
  return (
    invoiceableStatuses.has(order.status) &&
    order.items.length > 0 &&
    (order.paymentMethod !== "ONLINE" || order.paymentStatus === "PAID")
  );
}

export async function fetchOrderInvoicePdf(orderId: string) {
  const response = await requestCustomerApiResponse(
    `/orders/${encodeURIComponent(orderId)}/invoice`,
    {
      headers: { Accept: "application/pdf" },
      query: { format: "pdf" }
    }
  );

  if (!response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
    throw new ApiError("The invoice could not be downloaded. Please try again.", 502, "INVALID_INVOICE");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.length === 0) {
    throw new ApiError("The invoice is empty. Please try again.", 502, "INVALID_INVOICE");
  }

  return bytes;
}

export async function shareOrderInvoice(order: Order) {
  if (!canDownloadOrderInvoice(order)) {
    throw new Error("The invoice is not available for this order yet.");
  }

  const filename = `invoice-${order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;

  if (Platform.OS === "web") {
    const bytes = await fetchOrderInvoicePdf(order.id);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const link = document.createElement("a");

    try {
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    return;
  }

  const [{ File, Paths }, Sharing] = await Promise.all([
    import("expo-file-system"),
    import("expo-sharing")
  ]);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("File sharing is not available on this device.");
  }

  const bytes = await fetchOrderInvoicePdf(order.id);
  const file = new File(Paths.cache, filename);

  // The private PDF stays in app cache; only the OS share sheet receives its URI.
  file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    dialogTitle: `Invoice ${order.orderNumber}`,
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf"
  });
}
