import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { createServer } from "node:net";
import { loadEnvFile } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { waitForApi } from "./wait-for-api.mjs";

export function selectLanAddress(interfaces, override) {
  const candidates = Object.entries(interfaces).flatMap(([name, addresses]) =>
    (addresses ?? [])
      .filter((address) => address.family === "IPv4" && !address.internal)
      .map((address) => ({ name, address: address.address })),
  );
  if (override) {
    if (!candidates.some(({ address }) => address === override)) {
      throw new Error(
        "LAN_HOST must be an IPv4 address assigned to this computer",
      );
    }
    return override;
  }
  const lan = candidates.filter(
    ({ name, address }) =>
      !/vmware|vethernet|virtual|docker|wsl|vpn|loopback|tailscale|zerotier/i.test(
        name,
      ) && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address),
  );
  if (lan.length !== 1) {
    throw new Error(
      `Cannot choose one LAN address. Set LAN_HOST for this run. Candidates: ${lan.map(({ name, address }) => `${name}=${address}`).join(", ") || "none"}`,
    );
  }
  return lan[0].address;
}

export async function runDev() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const apiEnv = fileURLToPath(new URL("../apps/api/.env", import.meta.url));
  if (existsSync(apiEnv)) loadEnvFile(apiEnv);
  const host = selectLanAddress(networkInterfaces(), process.env.LAN_HOST);
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  const apiUrl = `http://${host}:${port}`;
  const npmCli = process.env.npm_execpath;
  if (!npmCli)
    throw new Error("Start from the repository root with npm run dev");

  // Refuse an occupied port so a different server cannot pass our health gate.
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(port, "0.0.0.0", () => probe.close(resolve));
  });

  const children = [];
  const abort = new AbortController();
  let stopping = false;
  function stop(code) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    abort.abort();
    for (const child of children) {
      if (!child.pid || child.exitCode !== null) continue;
      if (process.platform === "win32") {
        try {
          execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            windowsHide: true,
            stdio: "ignore",
          });
        } catch {
          /* The child may already have exited. */
        }
      } else {
        process.kill(-child.pid, "SIGTERM");
      }
    }
  }
  function start(args, env = process.env) {
    const child = spawn(process.execPath, [npmCli, ...args], {
      cwd: root,
      env,
      stdio: "inherit",
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    children.push(child);
    child.once("error", () => stop(1));
    child.once("exit", (code) => stop(code ?? 1));
    return child;
  }
  process.once("SIGINT", () => stop(0));
  process.once("SIGTERM", () => stop(0));
  console.log(`LAN API: ${apiUrl} (detected for this run; not saved)`);
  try {
    start(["run", "dev:api"]);
    await waitForApi(apiUrl, { signal: abort.signal });
    // Confirm health again before launching Expo, then monitor backend exit.
    await waitForApi(apiUrl, { signal: abort.signal });
    abort.signal.throwIfAborted();
    console.log(`API ready. Starting Expo with EXPO_PUBLIC_API_URL=${apiUrl}`);
    start(["--prefix", "apps/mobile", "run", "start", "--", "--lan"], {
      ...process.env,
      EXPO_PUBLIC_API_URL: apiUrl,
      REACT_NATIVE_PACKAGER_HOSTNAME: host,
    });
  } catch (error) {
    if (!stopping) console.error(error.message);
    stop(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await runDev().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
