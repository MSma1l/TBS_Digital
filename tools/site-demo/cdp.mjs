/**
 * One headless Edge or Chrome, driven over the DevTools protocol with Node's own WebSocket
 * (Node 22+), so the tool needs no npm package and no Puppeteer.
 *
 * Every launch gets a throwaway profile in the OS temp folder and lets the browser pick a free
 * debugging port (it writes the number into the profile), so two runs never collide on a port
 * and nothing of the person's own browser is touched. `close()` kills exactly the process tree
 * it started and deletes the profile — a run never leaves a headless browser behind.
 *
 * The real GPU is the default: tall `captureBeyondViewport` shots and the fixed-background
 * tiles stall under SwiftShader. `SITE_DEMO_GPU=soft` forces software rendering anyway.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/microsoft-edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findBrowser() {
  const own = process.env.SITE_DEMO_BROWSER;
  if (own) {
    if (!existsSync(own)) throw new Error(`SITE_DEMO_BROWSER points at a missing file: ${own}`);
    return own;
  }
  const found = BROWSERS.find((p) => existsSync(p));
  if (!found) throw new Error("No Edge or Chrome found — set SITE_DEMO_BROWSER to its executable.");
  return found;
}

function gpuFlags() {
  if (process.env.SITE_DEMO_GPU === "soft") return ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  if (process.platform === "win32") return ["--use-gl=angle", "--use-angle=d3d11", "--ignore-gpu-blocklist"];
  return ["--ignore-gpu-blocklist"];
}

/** Every browser this process started, so a Ctrl+C still closes them. */
const live = new Set();
let trapped = false;
function trapExit() {
  if (trapped) return;
  trapped = true;
  const bail = async () => {
    for (const b of live) await b.close();
    process.exit(130);
  };
  process.on("SIGINT", bail);
  process.on("SIGTERM", bail);
}

/**
 * Launch a browser and attach to its first tab.
 * `send` resolves with the command's result and rejects with its error; `ev` evaluates an
 * expression in the page (awaiting promises) and returns its value.
 */
export async function launch({ width, height, dpr = 1, mobile = false, name = "run" }) {
  trapExit();
  const exe = findBrowser();
  const profile = mkdtempSync(join(tmpdir(), `site-demo-${name}-`));
  const proc = spawn(exe, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    ...gpuFlags(),
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--mute-audio",
    "--hide-scrollbars",
    `--window-size=${width},${height}`,
    "about:blank",
  ], { stdio: "ignore" });

  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(150);
    try {
      port = Number(readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]) || 0;
    } catch {
      /* not written yet */
    }
  }
  let target = null;
  for (let i = 0; port && i < 50 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === "page") ?? null;
    } catch {
      /* not listening yet */
    }
    if (!target) await sleep(150);
  }
  if (!target) {
    killTree(proc.pid);
    await removeProfile(profile);
    throw new Error(`${exe} did not open a DevTools target`);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = () => fail(new Error("DevTools socket failed"));
  });
  let seq = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.error) p.fail(new Error(`${p.method}: ${m.error.message}`));
      else p.ok(m.result);
      return;
    }
    for (const fn of listeners.get(m.method) ?? []) {
      try {
        fn(m.params);
      } catch (err) {
        console.error("listener", m.method, err);
      }
    }
  };
  ws.onclose = () => {
    for (const p of pending.values()) p.fail(new Error(`${p.method}: socket closed`));
    pending.clear();
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const id = ++seq;
      pending.set(id, { ok, fail, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  };
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error("page: " + (d.exception?.description ?? d.text ?? "exception").slice(0, 700));
    }
    return r.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setScrollbarsHidden", { hidden: true });

  const move = (x, y) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" });
  const click = async (x, y) => {
    await move(x, y);
    await sleep(30);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
  };

  let closed = false;
  const b = {
    send, on, ev, move, click, width, height, dpr, mobile,
    async close() {
      if (closed) return true;
      closed = true;
      live.delete(b);
      try {
        ws.send(JSON.stringify({ id: ++seq, method: "Browser.close" }));
      } catch {
        /* already gone */
      }
      await sleep(700);
      try {
        ws.close();
      } catch {
        /* already closed */
      }
      killTree(proc.pid);
      await sleep(400);
      return removeProfile(profile);
    },
  };
  live.add(b);
  return b;
}

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(pid, "SIGKILL");
  } catch {
    /* it exited by itself */
  }
}

async function removeProfile(profile) {
  for (let i = 0; i < 10 && existsSync(profile); i++) {
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      await sleep(500); // a file stays locked for a moment after the process dies
    }
  }
  return !existsSync(profile);
}

/** Width and height of a WebP, PNG or JPEG, read from its header. */
export function imageSize(buf) {
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const fourcc = buf.toString("ascii", 12, 16);
    if (fourcc === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (fourcc === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (fourcc === "VP8L") {
      const v = buf.readUInt32LE(21);
      return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.toString("ascii", 1, 4) === "PNG") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let p = 2; p < buf.length; ) {
      if (buf[p] !== 0xff) {
        p++;
        continue;
      }
      const m = buf[p + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: buf.readUInt16BE(p + 7), h: buf.readUInt16BE(p + 5) };
      p += 2 + buf.readUInt16BE(p + 2);
    }
  }
  return null;
}

/** A minimal PNG decoder (8-bit RGB/RGBA, not interlaced) — what the browser's screenshots are. */
export function decodePng(buf) {
  let p = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9];
      if (data[8] !== 8 || data[12] !== 0) throw new Error("unsupported PNG");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
  if (!bpp) throw new Error(`unsupported PNG colour type ${ct}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  return {
    w,
    h,
    get: (x, y) => {
      const i = y * stride + x * bpp;
      return [out[i], out[i + 1], out[i + 2]];
    },
  };
}
