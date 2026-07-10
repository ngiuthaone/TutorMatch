const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const dataDir = path.join(root, "data");
const stateFile = path.join(dataDir, "state.json");
const allowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf"
};

function corsHeaders(request) {
  const origin = request.headers.origin;
  const allowOrigin = allowedOrigins.includes("*") || !origin
    ? "*"
    : allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function sendJson(request, response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(request)
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(dataDir, { recursive: true });
  const snapshot = {
    ...state,
    serverUpdatedAt: new Date().toISOString()
  };
  fs.writeFileSync(stateFile, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

async function handleApi(request, response, pathname) {
  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return true;
  }

  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(request, response, 200, { ok: true, storage: "file", stateFile: path.relative(root, stateFile) });
    return true;
  }

  if (pathname === "/api/state" && request.method === "GET") {
    sendJson(request, response, 200, { ok: true, state: readState() });
    return true;
  }

  if (pathname === "/api/state" && request.method === "POST") {
    try {
      const raw = await readBody(request);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed.state !== "object" || Array.isArray(parsed.state)) {
        sendJson(request, response, 400, { ok: false, error: "Missing state object" });
        return true;
      }
      const saved = writeState(parsed.state);
      sendJson(request, response, 200, { ok: true, updatedAt: saved.serverUpdatedAt });
    } catch (error) {
      sendJson(request, response, 400, { ok: false, error: error.message || "Invalid request" });
    }
    return true;
  }

  if (pathname === "/api/state" && request.method === "DELETE") {
    try {
      fs.rmSync(stateFile, { force: true });
      sendJson(request, response, 200, { ok: true });
    } catch (error) {
      sendJson(request, response, 500, { ok: false, error: error.message || "Could not reset state" });
    }
    return true;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(request, response, 404, { ok: false, error: "API route not found" });
    return true;
  }

  return false;
}

const server = http.createServer((request, response) => {
  const safeUrl = decodeURIComponent(request.url.split("?")[0]);
  handleApi(request, response, safeUrl).then((handled) => {
    if (handled) return;

  const requested = safeUrl === "/" ? "/index.html" : safeUrl;
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(root, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }
        response.writeHead(200, { "Content-Type": types[".html"] });
        response.end(fallback);
      });
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
  });
});

server.listen(port, host, () => {
  console.log(`TutorMatch MVP running at http://${host}:${port}`);
});
