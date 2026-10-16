import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMER_EMAIL_TEMPLATE_KEYS, type CustomerEmailEvent } from "@surgical/types";
import Handlebars from "handlebars";
import { customerEmailTemplates } from "../src/email/customer/catalog";
import { layout, palette, textLayout } from "../src/email/customer/layout";
import { previewDocument, renderCustomerEmail } from "../src/email/customer/render";
import {
  customerEmailSamples,
  sampleRecipient,
  sampleSettings
} from "../src/email/customer/samples";
import {
  buildCustomerEmailVariables,
  formatDate,
  formatMoney
} from "../src/email/customer/variables";

function renderSample(event: CustomerEmailEvent, recipient = sampleRecipient) {
  return renderCustomerEmail(
    event.template,
    buildCustomerEmailVariables(event, recipient, sampleSettings),
    { preview: true }
  );
}

function sample(key: keyof typeof customerEmailSamples, name: string) {
  const found = customerEmailSamples[key].find((entry) => entry.name === name);
  assert.ok(found, `missing sample ${key}/${name}`);
  return found.event;
}

test("every template key has a catalog entry and at least one sample", () => {
  assert.deepEqual(
    customerEmailTemplates.map(({ key }) => key).sort(),
    [...CUSTOMER_EMAIL_TEMPLATE_KEYS].sort()
  );
  for (const key of CUSTOMER_EMAIL_TEMPLATE_KEYS) {
    assert.ok(customerEmailSamples[key].length > 0, key);
    for (const { event } of customerEmailSamples[key]) assert.equal(event.template, key);
  }
});

test("all customer templates render every sample without missing variables", () => {
  for (const key of CUSTOMER_EMAIL_TEMPLATE_KEYS) {
    for (const { event } of customerEmailSamples[key]) {
      const rendered = renderSample(event);
      assert.doesNotMatch(
        rendered.html + rendered.text + rendered.subject,
        /{{|undefined|null|NaN|\[object Object\]/
      );
      assert.match(rendered.html, /<h1 /);
      assert.match(rendered.html, /name="color-scheme" content="light dark"/);
      assert.match(rendered.html, /prefers-color-scheme:dark/);
      assert.doesNotMatch(rendered.html, /<script|<img|<form|javascript:/i);
      assert.ok(
        Buffer.byteLength(rendered.html) < 80_000,
        "Keep messages comfortably below common clipping limits"
      );
    }
  }
});

test("templates use only built-in block helpers and escape customer text", () => {
  type Node = { [key: string]: unknown };
  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    const current = node as Node & {
      escaped?: boolean;
      params?: unknown[];
      path?: { original?: string };
      type?: string;
    };
    if (current.type === "BlockStatement")
      assert.ok(["if", "unless", "each"].includes(String(current.path?.original)));
    if (current.type === "MustacheStatement") {
      assert.equal(current.escaped, true, "Customer text must be HTML escaped");
      assert.equal(current.params?.length, 0, "No custom helpers");
    }
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  for (const template of customerEmailTemplates) {
    visit(Handlebars.parse(layout(template)));
    visit(Handlebars.parse(textLayout(template)));
  }
});

test("customer-supplied content is escaped in HTML and retained in plain text", () => {
  const answer = '<img src=x onerror="alert(1)"> & details';
  const rendered = renderSample({
    ...(sample("question-answered", "Answer available") as Extract<
      CustomerEmailEvent,
      { template: "question-answered" }
    >),
    answer
  });
  assert.doesNotMatch(rendered.html, /<img/);
  assert.match(rendered.html, /&lt;img/);
  assert.ok(rendered.text.includes(answer));
});

test("missing data, example production addresses, and unsafe links fail before rendering", () => {
  const variables = buildCustomerEmailVariables(
    sample("order-received", "Cash on delivery"),
    sampleRecipient,
    sampleSettings
  );
  assert.throws(
    () => renderCustomerEmail("order-received", { ...variables, order_number: "" }, { preview: true }),
    /order_number/
  );
  assert.throws(() => renderCustomerEmail("order-received", variables), /example/);
  assert.throws(
    () =>
      renderCustomerEmail(
        "order-received",
        { ...variables, order_url: "javascript:alert(1)" },
        { preview: true }
      ),
    /HTTPS/
  );
  assert.throws(
    () =>
      renderCustomerEmail(
        "order-received",
        { ...variables, order_url: "https://wrong.example.net/order" },
        { preview: true }
      ),
    /origin/
  );
  assert.throws(
    () => renderCustomerEmail("order-received", { ...variables, items: [] }, { preview: true }),
    /items/
  );
  assert.throws(
    () =>
      renderCustomerEmail(
        "order-received",
        { ...variables, order_number: "one\nBcc: stranger@example.com" },
        { preview: true }
      ),
    /line breaks/
  );
});

test("real settings render without preview mode", () => {
  const rendered = renderCustomerEmail(
    "welcome",
    buildCustomerEmailVariables({ template: "welcome" }, sampleRecipient, {
      brandName: "Surgical Medical Equipment",
      siteUrl: "https://shop.surgical-equipment.in/",
      supportEmail: "support@surgical-equipment.in"
    })
  );
  assert.match(rendered.html, /href="https:\/\/shop\.surgical-equipment\.in\/account"/);
});

test("copy never claims more than the recorded payment, return, or refund state", () => {
  const pending = renderSample(sample("order-received", "Online payment pending"));
  assert.match(pending.text, /Payment has not been confirmed/);
  assert.doesNotMatch(pending.text, /payment.*has been received/i);

  const cod = renderSample(sample("order-received", "Cash on delivery"));
  assert.match(cod.text, /₹2,360\.00 is payable when your order is delivered/);

  const approved = renderSample(sample("return-update", "Approved"));
  assert.match(approved.text, /separate update/);
  assert.doesNotMatch(approved.text, /refund.*completed/i);

  const underReview = renderSample(sample("order-cancelled", "Paid order; refund under review"));
  assert.match(underReview.text, /review the payment/);
  assert.doesNotMatch(underReview.text, /refund request has been recorded/);

  assert.match(
    renderSample(sample("refund-update", "Partial refund completed")).text,
    /partial refund of ₹590\.00/
  );
});

test("money, dates, items, and addresses are formatted for Indian customers", () => {
  assert.equal(formatMoney("2360"), "₹2,360.00");
  assert.equal(formatMoney("123456.5"), "₹1,23,456.50");
  assert.throws(() => formatMoney("12,00"), /Invalid money/);
  // 20:00 UTC is already the next day in India.
  assert.equal(formatDate("2026-09-07T20:00:00.000Z"), "8 September 2026");

  const rendered = renderSample(sample("order-received", "Cash on delivery"));
  assert.match(rendered.text, /Nitrile examination gloves · Medium · Box of 100 \| Qty 2 \| ₹600\.00 each \| ₹1,200\.00/);
  assert.match(rendered.text, /Deliver to: Aarav Sharma, Example Clinic, Sector 10, Chandigarh, Chandigarh 160010/);

  const noAddress = renderSample({
    ...(sample("order-received", "Cash on delivery") as Extract<
      CustomerEmailEvent,
      { template: "order-received" }
    >),
    deliveryAddress: null
  });
  assert.doesNotMatch(noAddress.text, /Deliver to/);
});

test("greeting falls back when the customer has no real first name", () => {
  for (const name of ["", "  ", "Customer"]) {
    const rendered = renderSample({ template: "welcome" }, { ...sampleRecipient, name });
    assert.match(rendered.text, /Hi there,/);
  }
  assert.match(renderSample({ template: "welcome" }).text, /Hi Aarav,/);
});

test("links point at the customer site routes", () => {
  const variables = buildCustomerEmailVariables(
    sample("question-answered", "Answer available"),
    sampleRecipient,
    sampleSettings
  );
  assert.equal(variables.product_url, "https://shop.example.com/products/demo-product");
  assert.equal(
    buildCustomerEmailVariables(sample("order-progress", "Packed"), sampleRecipient, sampleSettings)
      .order_url,
    "https://shop.example.com/account/orders/demo-order"
  );
});

test("both themes meet WCAG AA normal-text contrast for every text surface", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = (hex.slice(1).match(/../g) ?? [])
      .map((value) => parseInt(value, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return (r ?? 0) * 0.2126 + (g ?? 0) * 0.7152 + (b ?? 0) * 0.0722;
  };
  for (const [theme, p] of Object.entries(palette)) {
    for (const [fg, bg] of [
      [p.text, p.card],
      [p.muted, p.card],
      [p.muted, p.page],
      [p.text, p.soft],
      [p.accent, p.card],
      [p.buttonText, p.accent]
    ] as const) {
      const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
      assert.ok((a + 0.05) / (b + 0.05) >= 4.5, `${theme}: ${fg} on ${bg}`);
    }
  }
});

test("manual preview overrides stay out of sent HTML", () => {
  const template = customerEmailTemplates[0];
  assert.ok(template);
  const html = layout(template);
  assert.doesNotMatch(html, /:root\{color-scheme:dark\}/);
  assert.match(previewDocument(html, "dark"), /:root\{color-scheme:dark\}/);
  assert.match(previewDocument(html, "light"), /:root\{color-scheme:light\}/);
});
