import type { Response } from "express";
import { API_RESPONSE_SKIP_HEADER } from "../../common/interceptors/api-response.interceptor";
import { InvoiceFormat, type InvoiceFormatQueryDto } from "./dto/invoice.dto";
import type { InvoiceResponse } from "./invoices.service";

export function prepareInvoiceHttpResponse(
  invoice: InvoiceResponse,
  query: InvoiceFormatQueryDto,
  response: Response
) {
  const format = query.format ?? InvoiceFormat.Json;

  if (format === InvoiceFormat.Pdf) {
    const pdf = renderInvoicePdf(invoice);

    response.setHeader(API_RESPONSE_SKIP_HEADER, "true");
    response.setHeader("content-type", "application/pdf");
    response.setHeader("content-length", String(pdf.byteLength));
    response.setHeader(
      "content-disposition",
      `attachment; filename="${invoice.invoiceNumber}.pdf"`
    );

    return pdf;
  }

  if (format === InvoiceFormat.Html) {
    response.setHeader(API_RESPONSE_SKIP_HEADER, "true");
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.setHeader(
      "content-disposition",
      `attachment; filename="${invoice.invoiceNumber}.html"`
    );

    return invoice.html;
  }

  return invoice;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 50;
const PAGE_MARGIN_TOP = 50;
const PAGE_MARGIN_BOTTOM = 50;
const PAGE_START_Y = PAGE_HEIGHT - PAGE_MARGIN_TOP;

type PdfFont = "F1" | "F2";

type PdfTextLine = {
  font?: PdfFont;
  fontSize?: number;
  gapAfter?: number;
  text: string;
};

type PdfPlacedLine = Required<Omit<PdfTextLine, "gapAfter">> & {
  x: number;
  y: number;
};

function renderInvoicePdf(invoice: InvoiceResponse) {
  const pages = paginateLines(buildInvoicePdfLines(invoice));
  const kids = pages
    .map((_, index) => `${getPageObjectNumber(index)} 0 R`)
    .join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];

  for (const [index, page] of pages.entries()) {
    const pageObjectNumber = getPageObjectNumber(index);
    const contentObjectNumber = getContentObjectNumber(index);
    const content = buildPdfPageContent(page, index + 1, pages.length);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`
    );
    assertPdfObjectOrder(objects.length, pageObjectNumber, contentObjectNumber);
  }

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");

  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }

  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return Buffer.from(chunks.join(""), "utf8");
}

function buildInvoicePdfLines(invoice: InvoiceResponse): PdfTextLine[] {
  const itemRows = invoice.items.flatMap((item, index): PdfTextLine[] => {
    const taxParts =
      invoice.taxBreakup.taxType === "CGST_SGST"
        ? [
            `CGST: ${formatMoney(item.cgstAmount)} (${formatRate(item.cgstRate)}%)`,
            `SGST: ${formatMoney(item.sgstAmount)} (${formatRate(item.sgstRate)}%)`
          ]
        : [`IGST: ${formatMoney(item.igstAmount)} (${formatRate(item.igstRate)}%)`];
    const line = [
      `${index + 1}. ${item.description}`,
      `SKU: ${item.sku}`,
      `Qty: ${item.quantity}`,
      `Unit price: ${formatMoney(item.unitPrice)}`,
      `Taxable value: ${formatMoney(item.taxableValue)}`,
      ...taxParts,
      `Total: ${formatMoney(item.total)}`
    ].join(" | ");

    return wrapPdfText(line, 108).map((text, lineIndex) => ({
      font: lineIndex === 0 ? ("F2" as const) : ("F1" as const),
      fontSize: 9,
      gapAfter: lineIndex === 0 ? 2 : 0,
      text
    }));
  });

  return [
    { font: "F2", fontSize: 20, gapAfter: 8, text: "GST Invoice" },
    { text: `Invoice: ${invoice.invoiceNumber}` },
    { text: `Order: ${invoice.orderNumber}` },
    { gapAfter: 8, text: `Issued: ${new Date(invoice.issuedAt).toISOString()}` },
    { font: "F2", fontSize: 12, text: "Customer" },
    { text: `Name: ${invoice.customer.name}` },
    { text: `Business: ${invoice.customer.businessName ?? "Not provided"}` },
    { text: `Email: ${invoice.customer.email ?? "Not provided"}` },
    { text: `Mobile: ${invoice.customer.mobileNumber}` },
    { gapAfter: 8, text: `GSTIN: ${invoice.customer.gstNumber ?? "Not provided"}` },
    { font: "F2", fontSize: 12, text: "Billing" },
    { text: `Bill to: ${invoice.billing.name}` },
    ...wrapPdfText(`Address: ${invoice.billing.address}`, 96).map((text) => ({
      text
    })),
    { text: `Source state: ${invoice.sourceState ?? "Not provided"}` },
    { text: `Place of supply: ${invoice.billing.placeOfSupply}` },
    { gapAfter: 8, text: `Tax type: ${invoice.taxBreakup.taxType}` },
    { font: "F2", fontSize: 12, gapAfter: 4, text: "Items" },
    { font: "F2", fontSize: 9, text: "Description | SKU | Qty | Unit price | Taxable value | Tax | Total" },
    ...itemRows,
    { gapAfter: 8, text: "" },
    { font: "F2", fontSize: 12, text: "Totals" },
    { text: `Subtotal: ${formatMoney(invoice.totals.subtotal)}` },
    { text: `CGST: ${formatMoney(invoice.taxBreakup.cgst)}` },
    { text: `SGST: ${formatMoney(invoice.taxBreakup.sgst)}` },
    { text: `IGST: ${formatMoney(invoice.taxBreakup.igst)}` },
    { text: `Tax total: ${formatMoney(invoice.totals.tax)}` },
    { font: "F2", fontSize: 12, text: `Grand total: ${formatMoney(invoice.totals.grandTotal)}` }
  ];
}

function paginateLines(lines: PdfTextLine[]) {
  const pages: PdfPlacedLine[][] = [];
  let currentPage: PdfPlacedLine[] = [];
  let y = PAGE_START_Y;

  for (const line of lines) {
    const fontSize = line.fontSize ?? 10;
    const lineHeight = fontSize + 5;
    const gapAfter = line.gapAfter ?? 0;

    if (y - lineHeight < PAGE_MARGIN_BOTTOM && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      y = PAGE_START_Y;
    }

    currentPage.push({
      font: line.font ?? "F1",
      fontSize,
      text: line.text,
      x: PAGE_MARGIN_X,
      y
    });
    y -= lineHeight + gapAfter;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  const fallbackPage: PdfPlacedLine[] = [{
    font: "F1",
    fontSize: 10,
    text: "Invoice",
    x: PAGE_MARGIN_X,
    y: PAGE_START_Y
  }];

  return pages.length > 0 ? pages : [fallbackPage];
}

function buildPdfPageContent(
  lines: PdfPlacedLine[],
  pageNumber: number,
  totalPages: number
) {
  const commands = [
    "0.85 w",
    `${PAGE_MARGIN_X} ${PAGE_HEIGHT - 72} m ${PAGE_WIDTH - PAGE_MARGIN_X} ${PAGE_HEIGHT - 72} l S`,
    `${PAGE_MARGIN_X} 44 m ${PAGE_WIDTH - PAGE_MARGIN_X} 44 l S`
  ];

  for (const line of lines) {
    commands.push(
      "BT",
      `/${line.font} ${line.fontSize} Tf`,
      `${line.x} ${line.y} Td`,
      `(${escapePdfText(line.text)}) Tj`,
      "ET"
    );
  }

  commands.push(
    "BT",
    "/F1 8 Tf",
    `${PAGE_WIDTH - 110} 28 Td`,
    `(Page ${pageNumber} of ${totalPages}) Tj`,
    "ET"
  );

  return commands.join("\n");
}

function wrapPdfText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return [value];
  }

  const lines: string[] = [];
  const words = value.split(/\s+/);
  let line = "";

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;

    if (nextLine.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "");
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function formatRate(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getPageObjectNumber(pageIndex: number) {
  return 5 + pageIndex * 2;
}

function getContentObjectNumber(pageIndex: number) {
  return 6 + pageIndex * 2;
}

function assertPdfObjectOrder(
  objectsLength: number,
  pageObjectNumber: number,
  contentObjectNumber: number
) {
  if (objectsLength !== contentObjectNumber) {
    throw new Error(
      `Invalid invoice PDF object order for page ${pageObjectNumber}.`
    );
  }
}
