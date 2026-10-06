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

// Brand-Dienst von HA (ab 2026.3) nachgebaut: /api/brands/integration/<Domain>/<Bild>?token=...
// Mit Token, sonst 401. "matter" hat kein Logo (404), dark_icon.png gibt es nur für "zha".
// Als Bild eine Raute in der Farbe der Domain (SVG), damit Tests und Printscreens etwas sehen.
export const BRAND_TOKEN = "sim-token";
export const brandRequests = [];
function brand(url, res) {
  const u = new URL(url, "http://x");
  const m = u.pathname.match(/^\/api\/brands\/integration\/([a-z0-9_]+)\/([a-z_@0-9]+\.png)$/);
  if (!m) return false;
  brandRequests.push(`${m[1]}/${m[2]}`);
  if (u.searchParams.get("token") !== BRAND_TOKEN) res.writeHead(401).end("unauthorized");
  else if (m[1] === "matter" || (m[2] === "dark_icon.png" && m[1] !== "zha")) res.writeHead(404).end("not found");
  else {
    const hue = [...m[1]].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
    res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "no-store" });
    res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 1 23 12 12 23 1 12Z" fill="hsl(${hue} 65% 50%)"/><text x="12" y="16" font-size="11" text-anchor="middle" fill="#fff" font-family="sans-serif">${m[1][0].toUpperCase()}</text></svg>`);
  }
  return true;
}

export function startServer(port = 8950) {
  const server = createServer(async (req, res) => {
    if (brand(req.url, res)) return;
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
