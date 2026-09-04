export const REPORT_EXPORT_VIEWS = [
  "overview", "orders", "sales", "products", "inventory", "warehouses"
] as const;
export type ReportExportView = (typeof REPORT_EXPORT_VIEWS)[number];
export type ReportExportFormat = "csv" | "pdf";

export type ReportExportData = {
  cards: {
    activeCustomers: number;
    activeDeliveryPartners: number;
    activeWarehouses: number;
    lowStockProducts: number;
    nearExpiryBatches: number;
    pendingOrders: number;
    revenue: number;
    todayOrders: number;
    totalOrders: number;
  };
  charts: {
    ordersByDay: Array<{ date: string; orders: number }>;
    revenueByDay: Array<{ date: string; revenue: number }>;
    topSellingProducts: Array<{ name: string; productId: string; quantity: number; revenue: number; sku: string }>;
    stockAlerts: Array<ReportWarehouseAlerts>;
    warehouseStockSummary: Array<ReportWarehouseAlerts & { activeBatches: number; availableQuantity: number; reservedQuantity: number }>;
  };
  todayDate: string;
  warehouseOptions: Array<{ id: string; name: string; code: string }>;
  filters: {
    dateFrom: string;
    dateTo: string;
    nearExpiryDays: number;
    orderStatus: string | null;
    paymentStatus: string | null;
    warehouseId: string | null;
  };
};

type ReportWarehouseAlerts = {
  lowStockProducts: number;
  nearExpiryBatches: number;
  warehouseCode: string;
  warehouseId: string;
  warehouseName: string;
};


type ReportSection = {
  title: string;
  columns: string[];
  widths: number[];
  rows: string[][];
};
type ReportDocument = {
  title: string;
  metadata: string[][];
  metrics: string[][];
  sections: ReportSection[];
};
type CardKey = keyof ReportExportData["cards"];

const TITLES: Record<ReportExportView, string> = {
  overview: "Dashboard report",
  orders: "Orders report",
  sales: "Sales report",
  products: "Products report",
  inventory: "Inventory report",
  warehouses: "Warehouses report"
};
const CARD_KEYS: Record<ReportExportView, CardKey[]> = {
  overview: ["totalOrders", "todayOrders", "revenue", "pendingOrders", "lowStockProducts",
    "nearExpiryBatches", "activeCustomers", "activeDeliveryPartners", "activeWarehouses"],
  orders: ["totalOrders", "todayOrders", "pendingOrders"],
  sales: ["revenue", "totalOrders", "activeCustomers"],
  products: ["lowStockProducts", "revenue", "totalOrders"],
  inventory: ["lowStockProducts", "nearExpiryBatches", "activeWarehouses"],
  warehouses: ["activeWarehouses", "activeDeliveryPartners", "lowStockProducts"]
};
const CARD_LABELS: Record<CardKey, string> = {
  totalOrders: "Total orders",
  todayOrders: "Today orders",
  revenue: "Paid revenue (INR)",
  pendingOrders: "Pending orders",
  lowStockProducts: "Low stock products",
  nearExpiryBatches: "Near expiry batches",
  activeCustomers: "Active customers",
  activeDeliveryPartners: "Active delivery partners",
  activeWarehouses: "Active warehouses"
};

export function renderReportExport(
  report: ReportExportData,
  view: ReportExportView,
  format: ReportExportFormat
) {
  const document = buildReportDocument(report, view);
  const prefix = view === "overview" ? "dashboard" : view;
  const filename = `${prefix}-report-${report.filters.dateFrom || "all"}-to-${report.filters.dateTo || "today"}.${format}`;

  return {
    body: format === "pdf" ? renderPdf(document) : new TextEncoder().encode(renderCsv(document)),
    contentType: format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8",
    filename
  };
}

function buildReportDocument(report: ReportExportData, view: ReportExportView): ReportDocument {
  const warehouse = report.warehouseOptions.find((item) => item.id === report.filters.warehouseId);
  const warehouseLabel = warehouse
    ? `${warehouse.name} (${warehouse.code})`
    : report.filters.warehouseId ?? "All visible warehouses";
  const revenueLabel = report.filters.paymentStatus && report.filters.paymentStatus !== "PAID"
    ? `${statusLabel(report.filters.paymentStatus)} order value (INR)`
    : "Paid revenue (INR)";
  const stockView = view === "inventory" || view === "warehouses";
  const metadata = stockView
    ? [["Stock as of (UTC)", report.todayDate], ["Warehouse", warehouseLabel]]
    : [["Date from", report.filters.dateFrom || "All dates"], ["Date to", report.filters.dateTo || "Today"],
      ["Warehouse", warehouseLabel], ["Order status", statusLabel(report.filters.orderStatus)],
      ["Payment status", statusLabel(report.filters.paymentStatus)]];

  if (view === "overview" || stockView) {
    metadata.push(["Near expiry days", String(report.filters.nearExpiryDays)]);
  }
  if (view === "overview" || view === "orders") {
    metadata.push(["Today orders date (UTC)", report.todayDate]);
  }

  const sections: Record<Exclude<ReportExportView, "overview">, ReportSection> = {
    orders: {
      title: "Orders by day", columns: ["Date", "Orders"], widths: [30, 25],
      rows: report.charts.ordersByDay.map((item) => [item.date, String(item.orders)])
    },
    sales: {
      title: report.filters.paymentStatus && report.filters.paymentStatus !== "PAID"
        ? `${statusLabel(report.filters.paymentStatus)} order value by day` : "Revenue by day",
      columns: ["Date", revenueLabel], widths: [30, 42],
      rows: report.charts.revenueByDay.map((item) => [item.date, item.revenue.toFixed(2)])
    },
    products: {
      title: "Top selling products", columns: ["Product", "SKU", "Quantity", "Revenue (INR)"],
      widths: [33, 20, 8, 17],
      rows: report.charts.topSellingProducts.map((item) => [
        item.name, item.sku, String(item.quantity), item.revenue.toFixed(2)
      ])
    },
    inventory: {
      title: "Stock alerts", columns: ["Warehouse", "Code", "Low stock products", "Near expiry batches"],
      widths: [28, 12, 20, 19],
      rows: report.charts.stockAlerts.map((item) => [
        item.warehouseName, item.warehouseCode, String(item.lowStockProducts), String(item.nearExpiryBatches)
      ])
    },
    warehouses: {
      title: "Warehouse stock summary",
      columns: ["Warehouse", "Code", "Available", "Reserved", "Batches", "Low stock", "Near expiry"],
      widths: [21, 10, 9, 8, 7, 9, 10],
      rows: report.charts.warehouseStockSummary.map((item) => [
        item.warehouseName, item.warehouseCode, String(item.availableQuantity),
        String(item.reservedQuantity), String(item.activeBatches),
        String(item.lowStockProducts), String(item.nearExpiryBatches)
      ])
    }
  };

  return {
    title: TITLES[view], metadata,
    metrics: CARD_KEYS[view].map((key) => [
      key === "revenue" ? revenueLabel : CARD_LABELS[key],
      key === "revenue" ? report.cards[key].toFixed(2) : String(report.cards[key])
    ]),
    sections: view === "overview" ? Object.values(sections) : [sections[view]]
  };
}

function statusLabel(status: string | null) {
  return status ? status.toLowerCase().replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase()) : "All statuses";
}

function renderCsv(document: ReportDocument) {
  const rows = [
    [document.title], ...document.metadata, [], ["Metrics"], ["Metric", "Value"], ...document.metrics,
    ...document.sections.flatMap((section) => [[], [section.title], section.columns, ...section.rows])
  ];
  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}

function escapeCsvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 44;
const START_Y = PAGE_HEIGHT - MARGIN;
type PdfLine = { text: string; font?: "F1" | "F2" | "F3"; size?: number; gap?: number };
type PdfBlock = { lines: PdfLine[]; repeat?: PdfLine[] };
type PlacedLine = { text: string; font: "F1" | "F2" | "F3"; size: number; y: number };

function renderPdf(document: ReportDocument) {
  const blocks: PdfBlock[] = [{ lines: [
    { text: document.title, font: "F2", size: 20, gap: 12 },
    ...document.metadata.flatMap(([key, value]) => wrapText(`${key}: ${value}`, 88)
      .map((text): PdfLine => ({ text, font: "F3", size: 9 }))),
    { text: "", gap: 4 },
    ...document.metrics.map(([key, value]): PdfLine => ({ text: `${key}: ${value}` })),
    { text: "", gap: 4 }
  ] }];

  for (const section of document.sections) {
    const header: PdfLine[] = [
      { text: section.title, font: "F2", size: 13, gap: 6 },
      ...tableRow(section.columns, section.widths).map((text): PdfLine => ({ text, font: "F3", size: 8.5 })),
      { text: section.widths.map((width) => "-".repeat(width)).join("  "), font: "F3", size: 8.5 }
    ];
    const rows = section.rows.length ? section.rows : [["No data for this section."]];
    rows.forEach((row, index) => {
      const lines: PdfLine[] = tableRow(row, section.widths)
        .map((text): PdfLine => ({ text, font: "F3", size: 8.5 }));
      const lastLine = lines.at(-1);
      if (lastLine) lastLine.gap = 4;
      blocks.push({ lines: index === 0 ? [...header, ...lines] : lines, repeat: header });
    });
    blocks.push({ lines: [{ text: "", gap: 5 }] });
  }

  const pages = paginate(blocks);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${6 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"
  ];
  pages.forEach((page, index) => {
    const content = [
      ...page.map((line) => `BT /${line.font} ${line.size} Tf ${MARGIN} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`),
      `BT /F1 8 Tf ${MARGIN} 24 Td (Page ${index + 1} of ${pages.length}) Tj ET`
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7 + index * 2} 0 R >>`,
      `<< /Length ${new TextEncoder().encode(content).byteLength} >>\nstream\n${content}\nendstream`
    );
  });
  const chunks = ["%PDF-1.4\n"];
  const offsets: number[] = [];
  let length = new TextEncoder().encode("%PDF-1.4\n").byteLength;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    length += new TextEncoder().encode(chunk).byteLength;
  });
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.forEach((offset) => chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`);
  return new TextEncoder().encode(chunks.join(""));
}

function tableRow(cells: string[], widths: number[]) {
  const wrapped = widths.map((width, index) => wrapText(cells[index] ?? "", width));
  return Array.from({ length: Math.max(...wrapped.map((cell) => cell.length)) }, (_, index) =>
    wrapped.map((cell, column) => (cell[index] ?? "").padEnd(widths[column] ?? 0)).join("  ").trimEnd());
}

function wrapText(text: string, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = "";
    }
    let remaining = word;
    while (remaining.length > width) {
      lines.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    line = line ? `${line} ${remaining}` : remaining;
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

function paginate(blocks: PdfBlock[]) {
  let currentPage: PlacedLine[] = [];
  const pages: PlacedLine[][] = [currentPage];
  let y = START_Y;
  const newPage = () => {
    currentPage = [];
    pages.push(currentPage);
    y = START_Y;
  };
  const lineHeight = (line: PdfLine) => (line.size ?? 10) + 4 + (line.gap ?? 0);
  const addLine = (line: PdfLine) => {
    currentPage.push({ text: line.text, font: line.font ?? "F1", size: line.size ?? 10, y });
    y -= lineHeight(line);
  };
  for (const block of blocks) {
    const height = block.lines.reduce((total, line) => total + lineHeight(line), 0);
    if (height <= START_Y - MARGIN && y - height < MARGIN && currentPage.length) {
      newPage();
      if (block.repeat && block.lines[0] !== block.repeat[0]) block.repeat.forEach(addLine);
    }
    for (const line of block.lines) {
      if (y - lineHeight(line) < MARGIN && currentPage.length) {
        newPage();
        block.repeat?.forEach(addLine);
      }
      addLine(line);
    }
  }
  return pages;
}

// Standard PDF fonts use single-byte WinAnsi text, not UTF-8 inside literal strings.
function escapePdfText(text: string) {
  const winAnsi: Record<string, number> = {
    "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135,
    "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142,
    "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151,
    "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159
  };
  return [...text.replaceAll("₹", "INR ")].map((character) => {
    const code = winAnsi[character] ?? character.charCodeAt(0);
    if (code > 126 && code <= 255) return `\\${code.toString(8).padStart(3, "0")}`;
    if (code < 32 || code > 255) return "?";
    return /[\\()]/.test(character) ? `\\${character}` : character;
  }).join("");
}
