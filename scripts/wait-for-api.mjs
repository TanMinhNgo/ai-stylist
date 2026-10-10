import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export async function waitForApi(url, { timeoutMs = 90000, signal } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    try {
      const response = await fetch(new URL("/health", url), {
        signal: AbortSignal.any([
          AbortSignal.timeout(
            Math.min(2000, Math.max(1, deadline - Date.now())),
          ),
          ...(signal ? [signal] : []),
        ]),
      });
      if (response.ok && (await response.json()).status === "ok") return;
    } catch {
      signal?.throwIfAborted();
    }
    await delay(Math.min(500, Math.max(1, deadline - Date.now())), undefined, {
      signal,
    });
  }
  throw new Error(`API did not become healthy: ${url}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await waitForApi(process.argv[2] ?? "http://127.0.0.1:3000");
    console.log("API is ready");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
