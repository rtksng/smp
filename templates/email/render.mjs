import Handlebars from "handlebars";
import { URL } from "node:url";
import { layout, textLayout, themeRules } from "./layout.mjs";

const baseRequired = ["brand_name", "customer_name", "site_url", "support_email"];
export const requiredVariables = (template) => [
  ...new Set([...baseRequired, ...template.required])
];

export function validateVariables(template, variables, { preview = false } = {}) {
  for (const key of requiredVariables(template)) {
    const value = variables[key];
    if (key === "items") {
      if (!Array.isArray(value) || value.length === 0)
        throw new Error("items must contain at least one product");
      for (const item of value) {
        for (const field of ["name", "unit_price", "line_total"]) {
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
    if (
      variables[key] !== undefined &&
      variables[key] !== null &&
      typeof variables[key] !== "string"
    ) {
      throw new Error(`${key} must be text when supplied`);
    }
  }
  if (!/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(variables.support_email))
    throw new Error("support_email must be an email address");
  if (
    !preview &&
    /@(.*\.)?example\.(com|org|net)$|\.example$/i.test(variables.support_email)
  )
    throw new Error("Replace the example support email before sending");
  const site = new URL(variables.site_url);
  for (const key of requiredVariables(template).filter((key) => key.endsWith("_url"))) {
    let url;
    try {
      url = new URL(variables[key]);
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

export function renderTemplate(template, variables, options) {
  validateVariables(template, variables, options);
  const subject = Handlebars.compile(template.subject, { noEscape: true })(variables);
  if (/[\r\n]/.test(subject))
    throw new Error("Email subjects cannot contain line breaks");
  return {
    subject,
    html: Handlebars.compile(layout(template))(variables),
    text: Handlebars.compile(textLayout(template), { noEscape: true })(variables)
  };
}

// Preview-only CSS comes last, so both themes can be inspected on any OS setting.
// The MSG91 HTML exports retain automatic prefers-color-scheme handling only.
export function previewDocument(html, theme) {
  if (!["light", "dark"].includes(theme)) throw new Error("Unknown preview theme");
  return html.replace(
    "</head>",
    `<style>:root{color-scheme:${theme}}${themeRules(theme)}</style></head>`
  );
}
