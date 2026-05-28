import { NotImplementedException } from "@nestjs/common";
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
    throw new NotImplementedException(
      "Invoice PDF generation is not available yet. Download the HTML invoice instead."
    );
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
