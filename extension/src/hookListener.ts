import * as http from "http";

const HOOK_PORT = 38475;

type HookCallback = (branch: string) => void;

let server: http.Server | null = null;

/**
 * Starts a local HTTP server on port 38475.
 *
 * The post-push git hook sends a request here when the developer pushes.
 * This works regardless of whether the push came from VS Code, terminal,
 * or any GUI git client.
 *
 * Endpoint: POST /flowsync-hook
 * Body: { "event": "post-push", "branch": "feature/xyz" }
 */
export function startHookListener(onPush: HookCallback): void {
  if (server) {
    return; // already running
  }

  server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/flowsync-hook") {
      let body = "";

      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.event === "post-push" && parsed.branch) {
            onPush(parsed.branch);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "received" }));
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "invalid payload" }));
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(HOOK_PORT, "127.0.0.1", () => {
    console.log(`FlowSync hook listener running on port ${HOOK_PORT}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`FlowSync: port ${HOOK_PORT} already in use`);
    } else {
      console.error("FlowSync hook listener error:", err);
    }
  });
}

/**
 * Stops the hook listener. Called on extension deactivation.
 */
export function stopHookListener(): void {
  if (server) {
    server.close();
    server = null;
  }
}
