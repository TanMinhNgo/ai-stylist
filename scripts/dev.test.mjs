import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { selectLanAddress } from "./dev.mjs";
import { waitForApi } from "./wait-for-api.mjs";

const ipv4 = (address) => ({ family: "IPv4", internal: false, address });

test("detects current Wi-Fi on each run, ignoring virtual adapters", () => {
  for (const address of ["192.168.1.12", "10.20.30.40"]) {
    assert.equal(
      selectLanAddress({
        "Wi-Fi": [ipv4(address)],
        "VMware VMnet8": [ipv4("192.168.134.1")],
        "vEthernet (WSL)": [ipv4("172.20.1.1")],
      }),
      address,
    );
  }
});

test("requires a local override when multiple physical networks are present", () => {
  const interfaces = {
    "Wi-Fi": [ipv4("192.168.1.12")],
    Ethernet: [ipv4("10.0.0.5")],
  };
  assert.throws(() => selectLanAddress(interfaces), /LAN_HOST/);
  assert.equal(selectLanAddress(interfaces, "10.0.0.5"), "10.0.0.5");
  assert.throws(() => selectLanAddress(interfaces, "1.2.3.4"), /assigned/);
  assert.throws(() => selectLanAddress({}), /none/);
});

test("health gate waits through unhealthy responses before allowing the next step", async (t) => {
  let calls = 0;
  const server = createServer((req, res) => {
    assert.equal(req.url, "/health");
    calls++;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: calls === 1 ? "starting" : "ok" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await waitForApi(`http://127.0.0.1:${server.address().port}`, {
    timeoutMs: 3000,
  });
  assert.equal(calls, 2);
});

test("health gate times out on errors or wrong status even if JSON says ok", async (t) => {
  const server = createServer((req, res) => {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end('{"status":"ok"}');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(
    waitForApi(`http://127.0.0.1:${server.address().port}`, { timeoutMs: 100 }),
    /healthy/,
  );
});

test("health gate cancels when backend stops", async () => {
  const abort = new AbortController();
  abort.abort(new Error("backend stopped"));
  await assert.rejects(
    waitForApi("http://127.0.0.1:1", { signal: abort.signal }),
    /backend stopped/,
  );
});
