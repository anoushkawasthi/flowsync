import * as http from "http";
import * as net from "net";
import { log } from "./logger";

type HookCallback = (branch: string, remoteRef?: string) => void;

let server: http.Server | null = null;
let activePort: number | null = null;

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

export async function findAvailablePort(preferredPort: number): Promise<number> {
  log.step("findAvailablePort", `scanning from ${preferredPort}`);
  for (let p = preferredPort; p < preferredPort + 100; p++) {
    const free = await isPortFree(p);
    if (free) {
      log.ok("findAvailablePort", `port ${p} is free`);
      return p;
    }
    log.info("findAvailablePort", `port ${p} is taken, trying next`);
  }
  throw new Error(`FlowSync: no available port found in range ${preferredPort}–${preferredPort + 99}`);
}

export async function startHookListener(
  onPush: HookCallback,
  preferredPort: number
): Promise<number> {
  if (server) {
    log.info("startHookListener", `already running on port ${activePort}`);
    return activePort!;
  }

  const port = await findAvailablePort(preferredPort);
  log.step("startHookListener", `binding HTTP server on 127.0.0.1:${port}`);

  server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/flowsync-hook") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        log.info("hookListener", `received POST /flowsync-hook — body: ${body}`);
        try {
          const parsed = JSON.parse(body);
          if (parsed.event === "push" || parsed.event === "post-push") {
            // Accept empty branch (detached HEAD) — fall back to "HEAD"
            const branch = parsed.branch || "HEAD";
            log.ok("hookListener", `valid push signal — branch=${branch}${!parsed.branch ? " (detached HEAD fallback)" : ""}`);
            onPush(branch);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "received" }));
          } else {
            log.warn("hookListener", `invalid payload — expected event=push or post-push, got: ${body}`);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid payload" }));
          }
        } catch (e) {
          log.error("hookListener", `JSON parse failed: ${e} — raw body: ${body}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
    } else {
      log.warn("hookListener", `unexpected request: ${req.method} ${req.url}`);
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server!.listen(port, "127.0.0.1", () => resolve());
    server!.on("error", reject);
  });

  activePort = port;
  log.ok("startHookListener", `listening on port ${port}`);
  return port;
}

export function getActivePort(): number | null {
  return activePort;
}

export function stopHookListener(): void {
  if (server) {
    log.info("stopHookListener", `closing server on port ${activePort}`);
    server.close();
    server = null;
    activePort = null;
  }
}
