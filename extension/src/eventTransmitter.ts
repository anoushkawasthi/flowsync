import * as https from "https";
import * as http from "http";
import { log } from "./logger";

export interface CapturedEvent {
  eventId: string;
  projectId: string;
  eventType: "push" | "developer_note";
  timestamp: string;
  branch: string;
  payload: PushPayload;
}

export interface PushPayload {
  commitHash: string;
  message: string;
  diff: string;
  author: string;
  parentBranch?: string;
}

export async function transmitEvent(
  backendUrl: string,
  apiToken: string,
  event: CapturedEvent
): Promise<Record<string, unknown>> {
  const retryDelays = [0, 1000, 2000, 4000];

  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (retryDelays[attempt] > 0) {
      log.info("transmitEvent", `waiting ${retryDelays[attempt]}ms before retry attempt ${attempt + 1}`);
      await sleep(retryDelays[attempt]);
    }

    log.step("transmitEvent", `attempt ${attempt + 1}/${retryDelays.length} → POST ${backendUrl}/api/v1/events`);
    log.info("transmitEvent", `payload summary: eventId=${event.eventId} projectId=${event.projectId} branch=${event.branch} commitHash=${event.payload.commitHash.slice(0, 8)} author="${event.payload.author}" diffLen=${event.payload.diff.length}`);

    try {
      const result = await postJson(
        `${backendUrl}/api/v1/events`,
        apiToken,
        event as unknown as Record<string, unknown>
      );
      log.ok("transmitEvent", `HTTP 2xx — response: ${JSON.stringify(result)}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === retryDelays.length - 1) {
        log.error("transmitEvent", `all retries exhausted — last error: ${msg}`);
        throw err;
      }
      log.warn("transmitEvent", `attempt ${attempt + 1} failed: ${msg} — will retry`);
    }
  }

  throw new Error("FlowSync: transmit failed after all retries");
}

function postJson(
  url: string,
  token: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk: Buffer) => { responseBody += chunk.toString(); });
        res.on("end", () => {
          log.info("postJson", `response: HTTP ${res.statusCode} — ${responseBody.slice(0, 300)}`);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(responseBody)); }
            catch { resolve({}); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
          }
        });
      }
    );

    req.on("error", (err) => {
      log.error("postJson", `network error: ${err.message}`);
      reject(err);
    });
    req.write(data);
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}