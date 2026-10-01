// Statischer Server für den HA-Nachbau: /device_panel/panel/* kommt direkt
// aus custom_components (das getestete Panel), alles andere aus sim/.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const integration = join(here, "..", "..", "custom_components", "device_panel");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

function resolve(url) {
  const path = decodeURIComponent(new URL(url, "http://x").pathname);
  if (path.includes("..")) return null;
  if (path.startsWith("/device_panel/panel/")) return join(integration, "panel", path.slice("/device_panel/panel/".length));
  return join(here, "sim", normalize(path === "/" ? "/ha-sim.html" : path));
}

export function startServer(port = 8950) {
  const server = createServer(async (req, res) => {
    const file = resolve(req.url);
    try {
      if (!file) throw new Error("ungültiger Pfad");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startServer(Number(process.env.PORT || 8950));
  console.log("HA-Nachbau unter http://127.0.0.1:8950/ha-sim.html");
}
