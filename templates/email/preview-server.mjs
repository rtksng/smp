/* global console, process */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { extname, resolve, sep } from "node:path";

const root = fileURLToPath(new URL("./customer/", import.meta.url));
const port = Number(process.env.EMAIL_PREVIEW_PORT || 4177);
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    const file = resolve(
      root,
      `.${decodeURIComponent(url.pathname === "/" ? "/preview/index.html" : url.pathname)}`
    );
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    const contentType =
      {
        ".html": "text/html; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".txt": "text/plain; charset=utf-8"
      }[extname(file)] ?? "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Customer email preview: http://127.0.0.1:${port}`)
);
