import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import Handlebars from "handlebars";
import { templates, samplesFor } from "./catalog.mjs";
import { layout, palette, textLayout } from "./layout.mjs";
import { previewDocument, renderTemplate } from "./render.mjs";

test("all 12 customer templates render every scenario without missing variables", () => {
  assert.equal(templates.length, 12);
  assert.equal(new Set(templates.map(({ key }) => key)).size, 12);
  for (const template of templates) {
    for (const { variables } of samplesFor(template)) {
      const rendered = renderTemplate(template, variables, { preview: true });
      assert.doesNotMatch(
        rendered.html + rendered.text + rendered.subject,
        /{{|undefined|\[object Object\]/
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

test("MSG91 exports use only supported Handlebars features", () => {
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "BlockStatement")
      assert.ok(["if", "unless", "each"].includes(node.path.original));
    if (node.type === "MustacheStatement") {
      assert.equal(node.escaped, true, "Customer text must be HTML escaped");
      assert.equal(node.params.length, 0, "No unsupported custom helpers");
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  for (const template of templates) {
    visit(Handlebars.parse(layout(template)));
    visit(Handlebars.parse(textLayout(template)));
  }
});

test("customer-supplied content is escaped in HTML and retained in plain text", () => {
  const template = templates.find(({ key }) => key === "question-answered");
  const variables = {
    ...samplesFor(template)[0].variables,
    answer: '<img src=x onerror="alert(1)"> & details'
  };
  const rendered = renderTemplate(template, variables, { preview: true });
  assert.doesNotMatch(rendered.html, /<img/);
  assert.match(rendered.html, /&lt;img/);
  assert.ok(rendered.text.includes(variables.answer));
});

test("missing data, example production addresses, and unsafe links fail before rendering", () => {
  const template = templates.find(({ key }) => key === "order-received");
  const variables = samplesFor(template)[0].variables;
  assert.throws(
    () =>
      renderTemplate(template, { ...variables, order_number: "" }, { preview: true }),
    /order_number/
  );
  assert.throws(() => renderTemplate(template, variables), /example/);
  assert.throws(
    () =>
      renderTemplate(
        template,
        { ...variables, order_url: "javascript:alert(1)" },
        { preview: true }
      ),
    /HTTPS/
  );
  assert.throws(
    () =>
      renderTemplate(
        template,
        { ...variables, order_url: "https://wrong.example.net/order" },
        { preview: true }
      ),
    /origin/
  );
  assert.throws(
    () => renderTemplate(template, { ...variables, items: [] }, { preview: true }),
    /items/
  );
  assert.throws(
    () =>
      renderTemplate(
        template,
        { ...variables, order_number: "one\nBcc: stranger@example.com" },
        { preview: true }
      ),
    /line breaks/
  );
});

test("pending payments and returns never claim completed payment or refund", () => {
  const order = templates.find(({ key }) => key === "order-received");
  const pending = renderTemplate(order, samplesFor(order)[1].variables, {
    preview: true
  });
  assert.match(pending.text, /Payment has not been confirmed/);
  assert.doesNotMatch(pending.text, /payment.*has been received/i);
  const returns = templates.find(({ key }) => key === "return-update");
  const approved = renderTemplate(returns, samplesFor(returns)[1].variables, {
    preview: true
  });
  assert.match(approved.text, /separate update/);
  assert.doesNotMatch(approved.text, /refund.*completed/i);
  const refund = templates.find(({ key }) => key === "refund-update");
  assert.match(
    renderTemplate(refund, samplesFor(refund)[3].variables, { preview: true }).text,
    /partial refund of ₹590.00/
  );
});

test("both themes meet WCAG AA normal-text contrast for every text surface", () => {
  const luminance = (hex) => {
    const rgb = hex
      .slice(1)
      .match(/../g)
      .map((value) => parseInt(value, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const [theme, p] of Object.entries(palette)) {
    for (const [fg, bg] of [
      [p.text, p.card],
      [p.muted, p.card],
      [p.muted, p.page],
      [p.text, p.soft],
      [p.accent, p.card],
      [p.buttonText, p.accent]
    ]) {
      const [a, b] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      assert.ok((a + 0.05) / (b + 0.05) >= 4.5, `${theme}: ${fg} on ${bg}`);
    }
  }
});

test("manual preview overrides stay out of provider HTML", () => {
  const html = layout(templates[0]);
  assert.doesNotMatch(html, /:root\{color-scheme:dark\}/);
  assert.match(previewDocument(html, "dark"), /:root\{color-scheme:dark\}/);
  assert.match(previewDocument(html, "light"), /:root\{color-scheme:light\}/);
});
