const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const dns = require("node:dns").promises;
const net = require("node:net");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB demo limit
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

function isPrivateIPv4(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || p[0] >= 224;
}
function isPrivateIPv6(ip) {
  const s = ip.toLowerCase();
  return s === "::1" || s === "::" || s.startsWith("fc") || s.startsWith("fd") ||
    s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb") ||
    s.startsWith("::ffff:127.") || s.startsWith("::ffff:10.") || s.startsWith("::ffff:192.168.");
}
async function validatePublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("Invalid URL."); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP/HTTPS URLs are supported.");
  if (u.username || u.password) throw new Error("URLs containing usernames or passwords are not allowed.");
  if (!u.hostname || u.hostname === "localhost") throw new Error("Local URLs are not allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const ipType = net.isIP(host);
  if (ipType === 4 && isPrivateIPv4(host)) throw new Error("Private or reserved IP addresses are not allowed.");
  if (ipType === 6 && isPrivateIPv6(host)) throw new Error("Private or reserved IP addresses are not allowed.");
  if (!ipType) {
    let records;
    try { records = await dns.lookup(host, { all: true }); } catch { throw new Error("Host could not be resolved."); }
    if (!records.length || records.some(r => r.family === 4 ? isPrivateIPv4(r.address) : isPrivateIPv6(r.address))) {
      throw new Error("This host resolves to a private or reserved address.");
    }
  }
  return u;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "x-content-type-options": "nosniff" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
function serveStatic(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const requested = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const file = path.resolve(ROOT, "." + requested);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
  const ext = path.extname(file);
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream", "x-content-type-options": "nosniff" });
  fs.createReadStream(file).pipe(res);
}
async function handleDownload(res, rawUrl, redirects = 0) {
  if (redirects > 3) return send(res, 400, { error: "Too many redirects." });
  let u;
  try { u = await validatePublicUrl(rawUrl); }
  catch (e) { return send(res, 400, { error: e.message }); }

  const client = u.protocol === "https:" ? https : http;
  const request = client.get(u, { timeout: 15000, headers: { "User-Agent": "OmniSave-Demo/1.0", "Accept": "video/*,application/octet-stream;q=0.9,*/*;q=0.1" } }, upstream => {
    if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && upstream.headers.location) {
      upstream.resume();
      const next = new URL(upstream.headers.location, u).href;
      return handleDownload(res, next, redirects + 1);
    }
    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      upstream.resume();
      return send(res, 400, { error: `Source returned HTTP ${upstream.statusCode}.` });
    }
    const contentType = String(upstream.headers["content-type"] || "").split(";")[0].toLowerCase();
    const length = Number(upstream.headers["content-length"] || 0);
    if (!(contentType.startsWith("video/") || contentType === "application/octet-stream")) {
      upstream.resume();
      return send(res, 415, { error: "The URL did not return a video file. Use a direct public video URL." });
    }
    if (length > MAX_BYTES) {
      upstream.resume();
      return send(res, 413, { error: "Video exceeds the 100 MB demo limit." });
    }
    res.writeHead(200, {
      "content-type": contentType,
      "content-disposition": 'attachment; filename="video-download"',
      "x-content-type-options": "nosniff",
      "cache-control": "no-store"
    });
    let total = 0;
    upstream.on("data", chunk => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        upstream.destroy();
        res.destroy();
      }
    });
    upstream.pipe(res);
  });
  request.on("timeout", () => request.destroy(new Error("Request timed out.")));
  request.on("error", err => {
    if (!res.headersSent) send(res, 502, { error: "Could not fetch the video source: " + err.message });
    else res.destroy();
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url.startsWith("/api/download?")) {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const target = u.searchParams.get("url");
    if (!target) return send(res, 400, { error: "Missing url parameter." });
    return handleDownload(res, target);
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed." });
  serveStatic(req, res);
});
server.listen(PORT, "0.0.0.0", () => console.log(`OmniSave demo running at http://localhost:${PORT}`));
