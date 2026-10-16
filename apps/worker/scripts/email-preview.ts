// Local preview of the customer email templates with fictional sample data.
//   pnpm --filter @surgical/worker email:preview            serve on 127.0.0.1:4177
//   pnpm --filter @surgical/worker email:preview --out f.html  write a static gallery
// Nothing is sent; links inside the preview are inert.
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import { customerEmailTemplates } from "../src/email/customer/catalog";
import { previewDocument, renderCustomerEmail } from "../src/email/customer/render";
import {
  customerEmailSamples,
  sampleRecipient,
  sampleSettings
} from "../src/email/customer/samples";
import { buildCustomerEmailVariables } from "../src/email/customer/variables";

const { escapeExpression } = Handlebars;

type GalleryEntry = {
  name: string;
  scenarios: Array<{
    dark: string;
    event: unknown;
    light: string;
    name: string;
    subject: string;
    text: string;
  }>;
  trigger: string;
};

function buildEntries(): GalleryEntry[] {
  return customerEmailTemplates.map((template) => ({
    name: template.name,
    trigger: template.trigger,
    scenarios: customerEmailSamples[template.key].map(({ event, name }) => {
      const rendered = renderCustomerEmail(
        template.key,
        buildCustomerEmailVariables(event, sampleRecipient, sampleSettings),
        { preview: true }
      );
      return {
        dark: previewDocument(rendered.html, "dark"),
        event,
        light: previewDocument(rendered.html, "light"),
        name,
        subject: rendered.subject,
        text: rendered.text
      };
    })
  }));
}

function gallery(entries: GalleryEntry[]) {
  const payload = JSON.stringify(entries).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Customer email templates | Surgical Medical Equipment</title><style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f3faf9;color:#123f3c}header{padding:24px 28px;background:#fff;border-bottom:1px solid #c4e4e0}h1{font-size:24px;margin:6px 0 10px}p{line-height:1.6;margin:0}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#0f6f68;font-weight:bold}.layout{display:grid;grid-template-columns:270px minmax(0,1fr);min-height:80vh}nav{background:#fff;border-right:1px solid #c4e4e0;padding:16px}button,select{font:inherit}nav button{display:block;text-align:left;width:100%;padding:12px;border:0;border-radius:5px;background:transparent;color:#123f3c;cursor:pointer;line-height:1.4}nav button[aria-pressed=true]{background:#e5f5f3;color:#0f6f68;font-weight:bold}button:focus-visible,select:focus-visible{outline:3px solid #17a89d;outline-offset:3px}main{padding:24px;min-width:0}.toolbar{display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin:18px 0}label{display:grid;gap:6px;font-size:13px;font-weight:bold}select{background:#fff;color:#123f3c;padding:10px;border:1px solid #93bab5;border-radius:4px;max-width:100%}.subject{font-size:18px;font-weight:bold;line-height:1.5;overflow-wrap:anywhere}.trigger{font-size:14px;color:#55716e;max-width:850px}.stage{overflow:auto;padding:12px 0;min-height:400px}iframe{display:block;border:0;margin:auto;width:100%;max-width:680px;min-height:760px}details{margin:18px 0;max-width:850px}summary{cursor:pointer;font-size:14px;font-weight:bold}pre{background:#fff;border:1px solid #c4e4e0;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.6}.status{font-size:12px;color:#55716e;margin-top:10px}@media(max-width:760px){header{padding:20px}.layout{grid-template-columns:1fr}nav{display:flex;overflow-x:auto;padding:8px;border-right:0;border-bottom:1px solid #c4e4e0}nav button{flex:0 0 170px}main{padding:16px}iframe{max-width:100%}.toolbar{gap:10px}}
</style></head><body><header><div class="eyebrow">Surgical Medical Equipment</div><h1>Customer email templates</h1><p>${entries.length} transactional emails sent through Resend. Preview each status in light or dark mode.</p><p class="status">Fictional sample data · Rendered by the worker's template code · No messages sent</p></header><div class="layout"><nav aria-label="Customer templates">${entries.map((entry, index) => `<button type="button" data-index="${index}" aria-pressed="${index === 0}">${String(index + 1).padStart(2, "0")} &nbsp; ${escapeExpression(entry.name)}</button>`).join("")}</nav><main><div class="subject" id="subject" aria-live="polite"></div><p class="trigger" id="trigger"></p><div class="toolbar"><label>Scenario<select id="scenario"></select></label><label>Colour mode<select id="theme"><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Preview width<select id="width"><option value="680">Desktop</option><option value="360">Mobile · 360px</option><option value="320">Small mobile · 320px</option></select></label></div><div class="stage"><iframe id="email" title="Customer email preview" sandbox="allow-same-origin"></iframe></div><details><summary>Queued event (sent by the API)</summary><pre id="event"></pre></details><details><summary>Plain-text version</summary><pre id="plain"></pre></details></main></div><script type="application/json" id="template-data">${payload}</script><script>
const entries=JSON.parse(document.getElementById('template-data').textContent);let selected=0;const frame=document.getElementById('email');const scenario=document.getElementById('scenario');const theme=document.getElementById('theme');const width=document.getElementById('width');
function render(){const entry=entries[selected];const current=entry.scenarios[Number(scenario.value)||0];document.getElementById('subject').textContent=current.subject;document.getElementById('trigger').textContent=entry.trigger;frame.style.width=width.value+'px';frame.style.height='760px';frame.srcdoc=current[theme.value];document.getElementById('event').textContent=JSON.stringify(current.event,null,2);document.getElementById('plain').textContent=current.text;}
function select(index){selected=index;document.querySelectorAll('nav button').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));scenario.replaceChildren(...entries[index].scenarios.map((item,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=item.name;return option;}));render();}
document.querySelectorAll('nav button').forEach(button=>button.addEventListener('click',()=>select(Number(button.dataset.index))));scenario.addEventListener('change',render);theme.addEventListener('change',render);width.addEventListener('change',render);frame.addEventListener('load',()=>{const doc=frame.contentDocument;frame.style.height=Math.max(420,doc.documentElement.scrollHeight)+'px';doc.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault();});});select(0);
</script></body></html>\n`;
}

async function main() {
  const html = gallery(buildEntries());
  const outIndex = process.argv.indexOf("--out");

  if (outIndex !== -1) {
    const target = process.argv[outIndex + 1];
    if (!target) throw new Error("--out requires a file path");
    await writeFile(resolve(target), html);
    console.log(`Wrote customer email preview to ${resolve(target)}`);
    return;
  }

  const port = Number(process.env.EMAIL_PREVIEW_PORT || 4177);
  createServer((request, response) => {
    if (request.url !== "/") {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(html);
  }).listen(port, "127.0.0.1", () =>
    console.log(`Customer email preview: http://127.0.0.1:${port}`)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
