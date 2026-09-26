export const palette = {
  light: {
    page: "#f3faf9",
    card: "#ffffff",
    text: "#123f3c",
    muted: "#55716e",
    border: "#c4e4e0",
    soft: "#e5f5f3",
    accent: "#0f6f68",
    buttonText: "#ffffff"
  },
  dark: {
    page: "#111b1c",
    card: "#182628",
    text: "#eff7f6",
    muted: "#b2c9c6",
    border: "#334947",
    soft: "#223b3a",
    accent: "#65d6c7",
    buttonText: "#0d302d"
  }
};

export function themeRules(theme, prefix = "") {
  const p = palette[theme];
  return Object.entries({
    ".email-page": `background-color:${p.page}!important;color:${p.text}!important`,
    ".email-card": `background-color:${p.card}!important;border-color:${p.border}!important`,
    ".email-copy": `color:${p.text}!important`,
    ".email-muted": `color:${p.muted}!important`,
    ".email-line": `border-color:${p.border}!important`,
    ".email-note": `background-color:${p.soft}!important;color:${p.text}!important`,
    ".email-link": `color:${p.accent}!important`,
    ".email-button": `background-color:${p.accent}!important;color:${p.buttonText}!important`,
    ".email-button-link": `color:${p.buttonText}!important`
  })
    .map(([selector, rules]) => `${prefix}${selector}{${rules}}`)
    .join("\n");
}

export const paragraph = (text) =>
  `<p class="email-copy" style="margin:0 0 18px;color:#123f3c;font-size:16px;line-height:26px;overflow-wrap:anywhere">${text}</p>`;
export const note = (text) =>
  `<div class="email-note" style="margin:20px 0;padding:16px;background-color:#e5f5f3;color:#123f3c;border-radius:6px;font-size:15px;line-height:24px;overflow-wrap:anywhere">${text}</div>`;
export const details = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-collapse:collapse;table-layout:fixed">${rows.map(([label, value]) => `<tr><td class="email-muted email-line" width="38%" valign="top" style="width:38%;padding:10px 12px 10px 0;border-bottom:1px solid #c4e4e0;color:#55716e;font-size:14px;line-height:22px;overflow-wrap:anywhere">${label}</td><td class="email-copy email-line" valign="top" style="padding:10px 0;border-bottom:1px solid #c4e4e0;color:#123f3c;font-size:15px;line-height:22px;overflow-wrap:anywhere">${value}</td></tr>`).join("")}</table>`;
export const items = `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-collapse:collapse;table-layout:fixed"><caption class="email-copy" style="text-align:left;padding-bottom:8px;font-size:16px;font-weight:bold;color:#123f3c">Items</caption><thead><tr><th class="email-muted email-line" scope="col" align="left" width="65%" style="width:65%;padding:10px 8px 10px 0;border-bottom:1px solid #c4e4e0;color:#55716e;font-size:13px">Product</th><th class="email-muted email-line" scope="col" align="right" style="padding:10px 0;border-bottom:1px solid #c4e4e0;color:#55716e;font-size:13px">Total</th></tr></thead><tbody>{{#each items}}<tr><td class="email-copy email-line" valign="top" style="padding:12px 12px 12px 0;border-bottom:1px solid #c4e4e0;color:#123f3c;font-size:15px;line-height:23px;overflow-wrap:anywhere">{{name}}<br><span class="email-muted" style="color:#55716e;font-size:13px">Qty {{quantity}} · {{unit_price}} each</span></td><td class="email-copy email-line" valign="top" align="right" style="padding:12px 0;border-bottom:1px solid #c4e4e0;color:#123f3c;font-size:15px;line-height:23px;overflow-wrap:anywhere">{{line_total}}</td></tr>{{/each}}</tbody></table>`;
export const textItems =
  "Items\n{{#each items}}- {{name}} | Qty {{quantity}} | {{unit_price}} each | {{line_total}}\n{{/each}}";

export function layout(template) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${template.subject}</title>
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
@media screen and (max-width:620px){.email-outer{padding:16px 8px!important}.email-content{padding:24px 20px!important}.email-heading{font-size:24px!important;line-height:32px!important}}
@media (prefers-color-scheme:dark){${themeRules("dark")}}
${themeRules("dark", "[data-ogsc] ")}
${themeRules("dark", "[data-ogsb] ")}
</style>
</head>
<body class="email-page" style="margin:0;padding:0;width:100%;background-color:#f3faf9;color:#123f3c;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${template.preheader}</div>
<table role="presentation" class="email-page" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f3faf9"><tr><td class="email-outer" align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #c4e4e0;border-radius:8px"><tr><td class="email-content" style="padding:32px">
<p style="margin:0 0 28px;font-size:15px;line-height:22px;font-weight:bold"><a class="email-link" href="{{site_url}}" style="color:#0f6f68;text-decoration:none">{{brand_name}}</a></p>
<h1 class="email-copy email-heading" style="margin:0 0 20px;font-size:28px;line-height:36px;font-weight:bold;color:#123f3c;overflow-wrap:anywhere">${template.heading}</h1>
${paragraph("Hi {{customer_name}},")}
${template.body}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td class="email-button" align="center" bgcolor="#0f6f68" style="background-color:#0f6f68;border-radius:5px;mso-padding-alt:14px 22px"><a class="email-button-link" href="${template.actionUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:16px;line-height:22px;font-weight:bold;text-align:center;text-decoration:none;mso-padding-alt:0">${template.actionLabel}</a></td></tr></table>
<p class="email-muted" style="margin:0;font-size:13px;line-height:21px;color:#55716e;overflow-wrap:anywhere">If the button does not work, use this link:<br><a class="email-link" href="${template.actionUrl}" style="color:#0f6f68;text-decoration:underline;word-break:break-all">${template.actionUrl}</a></p>
<div class="email-line" style="margin-top:28px;padding-top:20px;border-top:1px solid #c4e4e0">
<p class="email-muted" style="margin:0;font-size:14px;line-height:23px;color:#55716e">Need help? Email <a class="email-link" href="mailto:{{support_email}}" style="color:#0f6f68;text-decoration:underline;overflow-wrap:anywhere">{{support_email}}</a>.</p>
</div>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
<p class="email-muted" style="max-width:560px;margin:16px auto 0;padding:0 12px;color:#55716e;font-size:12px;line-height:20px">This is an update about your account or activity with {{brand_name}}.</p>
</td></tr></table>
</body>
</html>\n`;
}

export function textLayout(template) {
  return `{{brand_name}}\n\n${template.heading}\n\nHi {{customer_name}},\n\n${template.text}\n\n${template.actionLabel}: ${template.actionUrl}\n\nNeed help? Email {{support_email}}.\n\nThis is an update about your account or activity with {{brand_name}}.\n`;
}
