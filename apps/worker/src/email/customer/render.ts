import Handlebars from "handlebars";
import type { CustomerEmailTemplateKey } from "@surgical/types";
import { getCustomerEmailTemplate, type CustomerEmailTemplate } from "./catalog";
import { layout, textLayout, themeRules, type EmailTheme } from "./layout";

export type CustomerEmailItemVariables = {
  line_total: string;
  name: string;
  quantity: number;
  unit_price: string;
};

export type CustomerEmailVariables = Record<
  string,
  CustomerEmailItemVariables[] | string | null | undefined
>;

export type RenderedCustomerEmail = {
  html: string;
  subject: string;
  text: string;
};

type RenderOptions = { preview?: boolean };

type CompiledTemplate = {
  html: HandlebarsTemplateDelegate;
  subject: HandlebarsTemplateDelegate;
  text: HandlebarsTemplateDelegate;
};

const baseRequired = ["brand_name", "customer_name", "site_url", "support_email"];
const compiled = new Map<CustomerEmailTemplateKey, CompiledTemplate>();

export function requiredVariables(template: CustomerEmailTemplate) {
  return [...new Set([...baseRequired, ...template.required])];
}

export function validateVariables(
  template: CustomerEmailTemplate,
  variables: CustomerEmailVariables,
  { preview = false }: RenderOptions = {}
) {
  for (const key of requiredVariables(template)) {
    const value = variables[key];
    if (key === "items") {
      if (!Array.isArray(value) || value.length === 0)
        throw new Error("items must contain at least one product");
      for (const item of value) {
        for (const field of ["name", "unit_price", "line_total"] as const) {
          if (typeof item[field] !== "string" || !item[field].trim())
            throw new Error(`items.${field} is required`);
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1)
          throw new Error("items.quantity must be a positive integer");
      }
    } else if (typeof value !== "string" || !value.trim()) {
      throw new Error(`${key} is required`);
    }
  }
  for (const key of template.optional ?? []) {
    const value = variables[key];
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new Error(`${key} must be text when supplied`);
    }
  }
  const supportEmail = String(variables.support_email);
  if (!/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(supportEmail))
    throw new Error("support_email must be an email address");
  if (!preview && /@(.*\.)?example\.(com|org|net)$|\.example$/i.test(supportEmail))
    throw new Error("Replace the example support email before sending");
  const site = new URL(String(variables.site_url));
  for (const key of requiredVariables(template).filter((key) => key.endsWith("_url"))) {
    let url: URL;
    try {
      url = new URL(String(variables[key]));
    } catch {
      throw new Error(`${key} must be an absolute HTTPS URL`);
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error(
        `${key} must be an absolute HTTPS URL without embedded credentials`
      );
    if (url.origin !== site.origin)
      throw new Error(`${key} must use the customer site's origin`);
    if (
      !preview &&
      /(^|\.)(example\.(com|org|net)|localhost)$|\.example$/i.test(url.hostname)
    )
      throw new Error("Replace example URLs before sending");
  }
}

export function renderCustomerEmail(
  key: CustomerEmailTemplateKey,
  variables: CustomerEmailVariables,
  options?: RenderOptions
): RenderedCustomerEmail {
  const template = getCustomerEmailTemplate(key);
  validateVariables(template, variables, options);
  const compiledTemplate = compile(template);
  const subject = compiledTemplate.subject(variables);
  if (/[\r\n]/.test(subject))
    throw new Error("Email subjects cannot contain line breaks");
  return {
    subject,
    html: compiledTemplate.html(variables),
    text: compiledTemplate.text(variables)
  };
}

// Preview-only CSS comes last, so both themes can be inspected on any OS setting.
// Sent HTML retains automatic prefers-color-scheme handling only.
export function previewDocument(html: string, theme: EmailTheme) {
  return html.replace(
    "</head>",
    `<style>:root{color-scheme:${theme}}${themeRules(theme)}</style></head>`
  );
}

function compile(template: CustomerEmailTemplate) {
  const cached = compiled.get(template.key);

  if (cached) {
    return cached;
  }

  const result: CompiledTemplate = {
    html: Handlebars.compile(layout(template)),
    subject: Handlebars.compile(template.subject, { noEscape: true }),
    text: Handlebars.compile(textLayout(template), { noEscape: true })
  };
  compiled.set(template.key, result);

  return result;
}
