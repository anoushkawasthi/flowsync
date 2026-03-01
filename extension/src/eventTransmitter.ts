import * as https from "https";
import * as http from "http";

/**
 * Event payload sent to the ingestion backend.
 * Matches the CapturedEvent interface from the spec.
 */
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

/**
 * Transmits a captured event to the backend ingestion endpoint.
 *
 * Retry strategy (from spec):
 * - On failure: retry at 1s → 2s → 4s (exponential backoff, max 3 attempts)
 *
 * Returns the response body on success, or throws on all retries exhausted.
 */
export async function transmitEvent(
  backendUrl: string,
  apiToken: string,
  event: CapturedEvent
): Promise<Record<string, unknown>> {
  const retryDelays = [0, 1000, 2000, 4000]; // first attempt immediate, then backoff

  for (let attempt = 0; attempt < retryDelays.length; attempt++) {
    if (retryDelays[attempt] > 0) {
      await sleep(retryDelays[attempt]);
    }

    try {
      const result = await postJson(
        `${backendUrl}/api/v1/events`,
        apiToken,
        event as unknown as Record<string, unknown>
      );
      return result;
    } catch (err) {
      if (attempt === retryDelays.length - 1) {
        throw err; // all retries exhausted
      }
      console.warn(
        `FlowSync: transmit attempt ${attempt + 1} failed, retrying...`
      );
    }
  }

  throw new Error("FlowSync: transmit failed after all retries");
}

/**
 * POST JSON to an endpoint with Bearer token auth.
 */
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
        res.on("data", (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody));
            } catch {
              resolve({});
            }
          } else {
            reject(
              new Error(`HTTP ${res.statusCode}: ${responseBody}`)
            );
          }
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
