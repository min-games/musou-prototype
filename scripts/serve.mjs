// Production-only static server for browser tests, including a Pages-style repository prefix.
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
createServer((req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname.startsWith("/musou/"))
      pathname = pathname.slice("/musou".length);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = resolve(root, "." + pathname);
    if (!file.startsWith(root + sep) || !statSync(file).isFile())
      throw new Error("Missing");
    res.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(5187, "127.0.0.1", () =>
  console.log("Production test server: http://127.0.0.1:5187 (also /musou/)"),
);
