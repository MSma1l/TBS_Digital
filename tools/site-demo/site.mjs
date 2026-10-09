/**
 * A browser session on one project site: Romanian, writes blocked, every load settled the same
 * way (cookie banner refused, intro skipped, the visitor state of the first load restored).
 */
import { launch, sleep } from "./cdp.mjs";
import { DISMISS_COOKIES, IMG_OPACITY, LANG_STATE, RO_CONTROL, SKIP_OVERLAYS } from "./page.mjs";

const MOBILE_UA = (ver) => `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ver} Mobile Safari/537.36 EdgA/${ver}`;

/**
 * Open a browser in a layout, on nothing yet. Every request of this page that is not GET / HEAD /
 * OPTIONS is failed before it leaves (bizcheck writes a record the moment a test starts; a probe
 * presses "start the test", "leave a review", "get an offer"); dialogs are dismissed, downloads
 * refused. Only this page's: a new tab, a cross-site frame, a worker or a WebSocket is not
 * intercepted (README: "Writes are blocked — the page's own").
 */
export async function openSite(site, layoutKey, L) {
  const b = await launch({ width: L.width, height: L.height, dpr: L.dpr, mobile: L.mobile, name: `${site.project}-${layoutKey}` });
  b.site = site;
  b.layout = L;
  b.blocked = [];
  b.docs = [];
  b.navs = [];
  b.dialogs = [];
  b.tabs = new Map();

  const inflight = new Map();
  let last = Date.now();
  let loaded = false;
  b.on("Network.requestWillBeSent", (p) => {
    if (/EventSource|WebSocket|Media/.test(p.type ?? "")) return; // long-lived streams never finish
    inflight.set(p.requestId, p.request.url);
    last = Date.now();
  });
  b.on("Network.loadingFinished", (p) => {
    inflight.delete(p.requestId);
    last = Date.now();
  });
  b.on("Network.loadingFailed", (p) => {
    inflight.delete(p.requestId);
    last = Date.now();
  });
  b.on("Network.responseReceived", (p) => {
    if (p.type === "Document") b.docs.push({ url: p.response.url, status: p.response.status });
  });
  b.on("Page.loadEventFired", () => {
    loaded = true;
  });
  b.on("Page.frameNavigated", (p) => {
    if (!p.frame.parentId) b.navs.push({ kind: "load", url: p.frame.url });
  });
  b.on("Page.navigatedWithinDocument", (p) => b.navs.push({ kind: "spa", url: p.url }));
  b.resetLoad = () => {
    loaded = false;
  };
  /** At least `min` ms, then until the load fired and <= `slack` requests were in flight for `quiet` ms. */
  b.idle = async ({ min = 3500, max = 12000, quiet = 900, slack = 2 } = {}) => {
    const t0 = Date.now();
    await sleep(min);
    while (Date.now() - t0 < max) {
      if (loaded && inflight.size <= slack && Date.now() - last >= quiet) break;
      await sleep(150);
    }
    return Date.now() - t0;
  };

  await b.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  b.on("Fetch.requestPaused", async (p) => {
    try {
      if (/^(GET|HEAD|OPTIONS)$/i.test(p.request.method)) await b.send("Fetch.continueRequest", { requestId: p.requestId });
      else {
        b.blocked.push(`${p.request.method} ${p.request.url.slice(0, 140)}`);
        await b.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" });
      }
    } catch {
      /* the request went away with its page */
    }
  });
  b.on("Page.javascriptDialogOpening", (p) => {
    b.dialogs.push(`${p.type}: ${String(p.message).slice(0, 100)}`);
    b.send("Page.handleJavaScriptDialog", { accept: false }).catch(() => {});
  });
  try {
    await b.send("Browser.setDownloadBehavior", { behavior: "deny" });
  } catch {
    /* not available on a page session: a download link is never pressed for real anyway */
  }
  await b.send("Target.setDiscoverTargets", { discover: true });
  b.on("Target.targetCreated", (p) => {
    if (p.targetInfo.type === "page") b.tabs.set(p.targetInfo.targetId, p.targetInfo.url);
  });
  b.on("Target.targetInfoChanged", (p) => {
    if (b.tabs.has(p.targetInfo.targetId)) b.tabs.set(p.targetInfo.targetId, p.targetInfo.url);
  });
  await sleep(200);
  b.ownTabs = new Set(b.tabs.keys());

  const { userAgent: ua } = await b.send("Browser.getVersion");
  const ver = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || "141.0.0.0";
  await b.send("Network.setUserAgentOverride", {
    userAgent: L.mobile ? MOBILE_UA(ver) : ua.replace(/HeadlessChrome/g, "Chrome"),
    acceptLanguage: "ro-RO,ro;q=0.9,en;q=0.8",
    platform: L.mobile ? "Android" : "Win32",
  });
  await b.send("Emulation.setLocaleOverride", { locale: "ro-RO" });
  return b;
}

/**
 * Navigate (a full load) and settle: idle-ish, cookie banner refused, intro skipped. Once the
 * visitor state is saved, every load starts from it: the tab goes blank first (so the old page's
 * unload handlers write their state before it is wiped), the site's storage and cookies are
 * cleared and the saved ones put back, and the saved local storage is written again at the start
 * of the new document, before the site's own scripts read it. So a test a probe advanced, a tab
 * it switched or a preference it changed never carries into the next load.
 */
export async function gotoUrl(b, url, opts = {}) {
  // A load that failed is the browser's own error page ("This page can't be opened"), and it
  // would be captured and surveyed like any other: a network hiccup is loaded again, and a page
  // that still does not come is an error — never a picture.
  for (let attempt = 1; ; attempt++) {
    const res = await loadOnce(b, url, opts);
    const why = res.errorText || (!/^https?:/.test(res.url) ? `landed on ${res.url}` : res.status >= 400 ? `HTTP ${res.status}` : null);
    if (!why) return res;
    if (attempt >= 3) throw new Error(`${url} did not load: ${why}`);
    console.warn(`    ${url} did not load (${why}) — again in 3 s`);
    await sleep(3000);
  }
}

async function loadOnce(b, url, { min = 3500, max = 12000 } = {}) {
  let restore = null;
  if (b.state) {
    await b.send("Page.navigate", { url: "about:blank" });
    await sleep(150);
    restore = await restoreState(b);
  }
  const n0 = b.docs.length;
  b.resetLoad();
  const nav = await b.send("Page.navigate", { url });
  try {
    return { ...(await settle(b, { min, max })), status: b.docs[n0]?.status ?? null, errorText: nav.errorText ?? null };
  } finally {
    if (restore) await b.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: restore }).catch(() => {});
  }
}

async function settle(b, { min, max }) {
  await b.idle({ min, max });
  const cookie = await b.ev(DISMISS_COOKIES);
  await sleep(cookie ? 1100 : 200);
  let skipped = await b.ev(SKIP_OVERLAYS);
  for (let t = 0; b.site.intro && !skipped.length && t < 4000; t += 300) {
    await sleep(300);
    skipped = await b.ev(SKIP_OVERLAYS);
  }
  if (skipped.length) await sleep(1200);
  return { cookie, skipped, url: await b.ev("location.href") };
}

/**
 * The home page in Romanian: the site's own RO control on a desktop (or its stored choice on a
 * phone, where the control hides in a menu), a reload so the page renders RO from scratch, and
 * a check — the site's own proof, Romanian diacritics in the text, no Cyrillic in the menu or
 * the headings. Then the visitor state is saved; every later load starts from it.
 */
export async function toRomanian(b) {
  const { site, layout } = b;
  const rep = { first: await gotoUrl(b, site.origin + "/", { min: 4500 }) };
  if (site.lang.control || site.lang.store) {
    const ctl = site.lang.control && !layout.mobile ? await b.ev(RO_CONTROL) : null;
    if (ctl) {
      await b.click(ctl.x, ctl.y);
      await sleep(2000);
      rep.via = "control";
    } else if (site.lang.store) {
      await b.ev(`localStorage.setItem(${JSON.stringify(site.lang.store[0])}, ${JSON.stringify(site.lang.store[1])})`);
      rep.via = "store";
    }
    b.resetLoad();
    await b.send("Page.reload", {});
    rep.second = await settle(b, { min: 3000, max: 12000 });
  }
  const s = await b.ev(LANG_STATE);
  const cyr = [...s.nav, ...s.h1, ...s.h2].filter((t) => /[Ѐ-ӿ]/.test(t));
  rep.state = { url: s.url, htmlLang: s.htmlLang, title: s.title, h1: s.h1, nav: s.nav.slice(0, 8), ro: s.ro, cyr };
  rep.ok = site.lang.ok(s) && s.ro >= 40 && !cyr.length;
  if (rep.ok) b.state = await saveState(b);
  return rep;
}

/** The site's cookies and local storage as they are now (Romanian chosen, cookies refused). */
async function saveState(b) {
  const { cookies } = await b.send("Network.getCookies", { urls: [b.site.origin + "/"] });
  const local = await b.ev(`(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })()`);
  return { origin: new URL(b.site.origin).origin, cookies, local };
}

/** Wipe the site's storage, put the saved cookies back, and arm the local-storage writer. */
async function restoreState(b) {
  const { origin, cookies, local } = b.state;
  try {
    await b.send("Storage.clearDataForOrigin", { origin, storageTypes: "cookies,local_storage,indexeddb,cache_storage,service_workers" });
    const keep = cookies.map(({ name, value, domain, path, secure, httpOnly, sameSite, expires }) => ({
      name, value, domain, path, secure, httpOnly, ...(sameSite ? { sameSite } : {}), ...(expires > 0 ? { expires } : {}),
    }));
    if (keep.length) await b.send("Network.setCookies", { cookies: keep });
  } catch (err) {
    console.warn("  storage not reset:", err.message);
  }
  // top frame only: a same-origin iframe must not wipe what the page wrote while it started
  const source = `try { if (window === window.top && location.origin === ${JSON.stringify(origin)}) { sessionStorage.clear(); for (const [k, v] of Object.entries(${JSON.stringify(local)})) localStorage.setItem(k, v); } } catch (e) { /* storage blocked */ }`;
  return (await b.send("Page.addScriptToEvaluateOnNewDocument", { source })).identifier;
}

/** Slow scroll to the bottom (lazy content, reveal-on-scroll), then back to the top. */
export async function scrollThrough(b, { step = 600, every = 250 } = {}) {
  let y = 0;
  let steps = 0;
  for (;;) {
    y += step;
    steps++;
    await b.ev(`window.scrollTo({ top: ${y}, behavior: "instant" })`);
    await sleep(every);
    const cur = await b.ev("({ sh: document.scrollingElement.scrollHeight, y: Math.round(scrollY), ih: innerHeight })");
    if (cur.y + cur.ih >= cur.sh - 2) {
      await sleep(700);
      if ((await b.ev("document.scrollingElement.scrollHeight")) <= cur.sh) break;
    }
    if (steps > 200) break;
  }
  await b.ev(`window.scrollTo({ top: 0, behavior: "instant" })`);
  await sleep(900);
  return steps;
}

/** Until no visible image is mid-fade: two samples 200 ms apart must match (at most 4 s). */
export async function waitStable(b) {
  const t = Date.now();
  let prev = await b.ev(IMG_OPACITY);
  while (Date.now() - t < 4000) {
    await sleep(200);
    const cur = await b.ev(IMG_OPACITY);
    const keys = new Set([...Object.keys(prev), ...Object.keys(cur)]);
    const changing = [...keys].filter((k) => prev[k] !== cur[k]);
    prev = cur;
    if (!changing.length) break;
  }
  return Date.now() - t;
}
