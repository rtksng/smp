/* global console */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { join } from "node:path";
import { templates, samplesFor } from "./catalog.mjs";
import { layout, textLayout } from "./layout.mjs";
import { previewDocument, renderTemplate, requiredVariables } from "./render.mjs";
import { gallery } from "./gallery.mjs";

const root = fileURLToPath(new URL("./customer/", import.meta.url));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
for (const folder of ["html", "text", "samples", "preview"])
  await mkdir(join(root, folder), { recursive: true });
const manifest = [];
const payloads = [];
const previews = [];
for (const template of templates) {
  const slug = `smp-customer-${template.key}`;
  const html = layout(template);
  const samples = samplesFor(template);
  const scenarios = samples.map(({ name, variables }) => {
    const rendered = renderTemplate(template, variables, { preview: true });
    return {
      name,
      variables,
      subject: rendered.subject,
      text: rendered.text,
      light: previewDocument(rendered.html, "light"),
      dark: previewDocument(rendered.html, "dark")
    };
  });
  await writeFile(join(root, "html", `${slug}.html`), html);
  await writeFile(join(root, "text", `${slug}.txt`), textLayout(template));
  await writeFile(join(root, "samples", `${slug}.json`), json(samples));
  payloads.push({
    name: `SMP Customer - ${template.name}`,
    slug,
    subject: template.subject,
    body: html
  });
  manifest.push({
    key: template.key,
    name: template.name,
    slug,
    category: template.category,
    subject: template.subject,
    preheader: template.preheader,
    trigger: template.trigger,
    source: template.source,
    requiredVariables: requiredVariables(template),
    optionalVariables: template.optional ?? [],
    itemFields: template.required.includes("items")
      ? ["name", "quantity", "unit_price", "line_total"]
      : [],
    html: `html/${slug}.html`,
    text: `text/${slug}.txt`,
    samples: `samples/${slug}.json`,
    scenarios: scenarios.map(({ name }) => name),
    msg91TemplateId: null,
    status: "LOCAL_DRAFT"
  });
  previews.push({ name: template.name, slug, trigger: template.trigger, scenarios });
}
await writeFile(
  join(root, "manifest.json"),
  json({
    audience: "customer",
    count: templates.length,
    provider: "MSG91",
    sendingEnabled: false,
    templates: manifest
  })
);
await writeFile(join(root, "msg91-create-templates.json"), json(payloads));
await writeFile(join(root, "preview", "index.html"), gallery(previews));
console.log(
  `Built ${templates.length} customer templates and ${previews.reduce((count, item) => count + item.scenarios.length, 0)} scenarios in light and dark mode.`
);
