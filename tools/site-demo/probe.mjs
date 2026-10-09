/**
 * What each control of a page really does, found out by pressing it on the live site, with every
 * write blocked (site.mjs). An href is not enough on a single-page app: on bizcheck's home page
 * 9 of the 10 controls that open another page are `<a href="/">` or a `<button>` with a click
 * handler, and cgam's "Liga" is an `<a>` with no href that scrolls by script.
 *
 * Each probed control is found again on a fresh load (by the element path the survey recorded,
 * else by its tag and text), scrolled into view, pressed with a real mouse click, and the page is
 * watched until it settles: a route, a full load, a new tab, a dialog or a scroll lock, a scroll,
 * a carousel moving, an ARIA state flipping, content changing, a field taking focus — or nothing.
 * When changed content is all it saw, the same wait is repeated on a fresh load with nothing
 * pressed, and where the page changed by itself is set against where the press changed it: cgam's
 * home page changes on its own every few seconds, which would pass its hero tagline (a `cursor:
 * pointer` paragraph with no handler) for a control — while the phone icon in its header, whose
 * number shows on hover, changes right at the icon. After anything but a scroll or a focus the
 * page is loaded again from the saved visitor state.
 * Members of a large group of look-alike controls (19 gallery tiles) are pressed twice at most;
 * the rest take their siblings' effect.
 */
import { sleep } from "./cdp.mjs";
import { classifyStatic } from "./build.mjs";
import { HIDE_FLOATERS, HIT_POINT, LOCATE, PROBE_STATE, keyText } from "./page.mjs";
import { gotoUrl } from "./site.mjs";

const PROBED = new Set(["button", "toggle", "self", "js-link", "anchor"]);
const MAX_PER_GROUP = 2;
const IDLE_KINDS = new Set(["scroll", "focus", "none", "hash"]);

/** The probe key of a control: same tag, class, section (and text, in a header or for an anchor). */
const groupOf = (it, kind) => [it.tag, it.cls.slice(0, 40), it.section ?? "", it.zone === "header" || kind === "anchor" ? keyText(it) + (it.href ?? "") : ""].join("|");

/**
 * How close to the control two snapshots differ (PROBE_STATE `chain`): 0 in the control itself,
 * k in its k-th ancestor, the chain's length for elsewhere on the page — or false for nowhere.
 */
const changedAt = (a, b) => {
  const n = Math.min(a.chain.length, b.chain.length);
  for (let k = 0; k < n; k++) if (a.chain[k] !== b.chain[k]) return k;
  return a.chain.length !== b.chain.length || a.textLen !== b.textLen ? n : false;
};

export async function probePage(b, url, survey, H, log = () => {}) {
  const { items } = survey;
  const results = items.map(() => null);
  const groups = new Map();
  const todo = [];
  for (const it of items) {
    if (it.y >= H || it.disabled) continue;
    const { kind } = classifyStatic(it, url);
    if (!PROBED.has(kind) && !(kind === "internal" && it.handler)) continue;
    const g = groupOf(it, kind);
    const n = (groups.get(g) ?? 0) + 1;
    groups.set(g, n);
    if (n <= MAX_PER_GROUP) todo.push({ i: it.i, g });
    else results[it.i] = { group: g, inferred: true };
  }

  const fresh = async () => {
    await gotoUrl(b, url, { min: 2500, max: 9000 });
    await b.ev(HIDE_FLOATERS);
    await b.ev("window.scrollTo({ top: 0, behavior: 'instant' })");
    await sleep(300);
  };
  const quickScroll = async () => {
    const sh = await b.ev("document.scrollingElement.scrollHeight");
    for (let y = 0; y < sh; y += b.height) {
      await b.ev(`window.scrollTo({ top: ${y}, behavior: "instant" })`);
      await sleep(120);
    }
    await b.ev("window.scrollTo({ top: 0, behavior: 'instant' })");
    await sleep(300);
  };

  const t0 = Date.now();
  let dirty = true;
  let clicks = 0;
  for (const { i, g } of todo) {
    const it = items[i];
    if (dirty) {
      await fresh();
      dirty = false;
    }
    let found = await b.ev(LOCATE(it));
    if (!found) {
      await quickScroll(); // a section mounted only once scrolled into view
      found = await b.ev(LOCATE(it));
    }
    if (!found) {
      results[i] = { group: g, error: "not found again" };
      continue;
    }
    // A fixed control (a header link) is pressed from the middle of the page, so a jump to the
    // top is a scroll too; anything else from where it sits in the middle of the screen.
    if (it.fixed) await b.ev("window.scrollTo({ top: Math.round((document.scrollingElement.scrollHeight - innerHeight) * 0.43), behavior: 'instant' })");
    else await b.ev(`document.querySelector("[data-sd-probe]").scrollIntoView({ block: "center", behavior: "instant" })`);
    await sleep(350);
    const hit = await b.ev(HIT_POINT);
    if (!hit || hit.off) {
      results[i] = { group: g, error: "off screen" };
      continue;
    }
    const before = await b.ev(PROBE_STATE);
    const navs0 = b.navs.length;
    const tabs0 = new Set(b.tabs.keys());
    const dialogs0 = b.dialogs.length;
    const writes0 = b.blocked.length;
    await b.click(hit.x, hit.y);
    clicks++;
    let after = before;
    let prev = null;
    const tw = Date.now();
    while (Date.now() - tw < 2400) {
      await sleep(200);
      try {
        after = await b.ev(PROBE_STATE);
      } catch {
        await sleep(1500); // a full load in progress
        try {
          after = await b.ev(PROBE_STATE);
        } catch {
          /* still loading */
        }
        break;
      }
      const sig = JSON.stringify([after.url, after.sy, after.dialogs, after.overlays, after.textLen, after.el, after.secHash, after.secScroll]);
      if (Date.now() - tw >= 600 && sig === prev) break;
      prev = sig;
    }
    const navs = b.navs.slice(navs0).map((n) => n.kind);
    const newTabs = [...b.tabs.entries()].filter(([id]) => !tabs0.has(id) && !b.ownTabs.has(id));
    const eff = [];
    const noHash = (u) => u.split("#")[0];
    const moved = noHash(after.url) !== noHash(before.url);
    if (moved) eff.push({ type: navs.includes("load") ? "load" : "route", url: after.url, sy: after.sy });
    else if (after.url !== before.url) eff.push({ type: "hash", url: after.url });
    if (newTabs.length) eff.push({ type: "newtab", url: newTabs[0][1] });
    const nd = after.dialogs.filter((d) => !before.dialogs.includes(d));
    const no = after.overlays.filter((d) => !before.overlays.includes(d));
    const lock = (after.bodyOv === "hidden" && before.bodyOv !== "hidden") || (after.htmlOv === "hidden" && before.htmlOv !== "hidden");
    if (nd.length || no.length || lock || b.dialogs.length > dialogs0) eff.push({ type: "modal", text: (nd[0] || no[0] || b.dialogs[dialogs0] || "(scroll lock)").slice(0, 140) });
    if (!moved && (Math.abs(after.sy - before.sy) > 40 || classifyStatic(it, url).kind === "anchor")) eff.push({ type: "scroll", y: after.sy, from: before.sy });
    if (after.secScroll !== before.secScroll) eff.push({ type: "slide" });
    if (after.el && before.el && ["exp", "sel", "pressed", "checked"].some((k) => after.el[k] !== before.el[k])) eff.push({ type: "toggle" });
    if (!eff.some((e) => /^(modal|route|load)$/.test(e.type)) && after.secHash !== before.secHash) eff.push({ type: "content", lvl: changedAt(before, after) });
    if (!eff.length && after.textLen !== before.textLen) eff.push({ type: "content", lvl: changedAt(before, after) });
    if (after.active !== before.active && /^(INPUT|TEXTAREA|SELECT)/.test(after.active)) eff.push({ type: "focus" });
    if (!eff.length) eff.push({ type: "none" });
    const writes = b.blocked.slice(writes0);
    results[i] = { group: g, found, eff, ...(writes.length ? { writes } : {}), ...(hit.ok ? {} : { covered: hit.hit }) };
    for (const [id] of newTabs) await b.send("Target.closeTarget", { targetId: id }).catch(() => {});
    // Changed text alone may not be the press: a slideshow or a counter changes on its own. So
    // the same wait again on a fresh load, nothing pressed, the pointer away from it — and where
    // the page changed then (`self`, a chain level or false) is compared with where the press
    // changed it (build.mjs).
    if (eff.every((e) => e.type === "content")) {
      results[i].self = await changesByItself(it);
      dirty = true;
    } else {
      dirty = eff.some((e) => !IDLE_KINDS.has(e.type));
    }
    const fx = eff.map((e) => e.type + (e.url ? " " + e.url.replace(/^https?:\/\/[^/]+/, "") : e.y != null ? " " + e.y : e.lvl != null ? "@" + e.lvl : ""));
    const self = typeof results[i].self === "number" ? ` (changes by itself @${results[i].self})` : "";
    log(`    ${String(i).padStart(3)} ${keyText(it).slice(0, 32).padEnd(32)} ${fx.join(", ")}${self}${writes.length ? `  [blocked ${writes.length} write]` : ""}`);
    if (!dirty) await b.ev("document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1");
  }
  return { results, clicks, inferred: results.filter((r) => r?.inferred).length, ms: Date.now() - t0 };

  /** Where the page changes within 4 s with nothing pressed (changedAt), or null if not found. */
  async function changesByItself(it) {
    await fresh();
    if (!(await b.ev(LOCATE(it)))) {
      await quickScroll();
      if (!(await b.ev(LOCATE(it)))) return null;
    }
    if (it.fixed) await b.ev("window.scrollTo({ top: Math.round((document.scrollingElement.scrollHeight - innerHeight) * 0.43), behavior: 'instant' })");
    else await b.ev(`document.querySelector("[data-sd-probe]").scrollIntoView({ block: "center", behavior: "instant" })`);
    await b.move(2, b.height - 2);
    await sleep(350);
    const s0 = await b.ev(PROBE_STATE);
    await sleep(4000);
    return changedAt(s0, await b.ev(PROBE_STATE));
  }
}
