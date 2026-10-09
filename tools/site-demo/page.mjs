/**
 * Scripts evaluated inside the captured site's tab (strings, or functions turned into strings).
 *
 * Everything the tool puts into a page is marked: injected nodes get an id starting `__sd`,
 * marked elements a `data-sd-*` attribute. The survey's element paths skip `__sd` nodes, so a
 * path measured on a page with the background tiles in it still finds the same element on a
 * fresh load of that page (where the probe clicks it).
 */

/** Click a cookie banner's reject / essentials-only button. Returns what was clicked. */
export const DISMISS_COOKIES = `(() => {
  const RX = /^(отклонить|отказаться|reject|decline|deny|refuz|respinge|resping|doar esen|numai esen|only essential|essential only|только необходим|use necessary)/i;
  const btns = [...document.querySelectorAll("button, a, [role=button]")].filter((b) => {
    const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && RX.test((b.innerText || "").trim());
  });
  const inCookie = btns.find((b) => /cookie/i.test(b.closest("div, section, aside, dialog")?.parentElement?.innerText || ""));
  const b = inCookie || btns[0];
  if (!b) return null;
  const t = b.innerText.trim();
  b.click();
  return t;
})()`;

/** Click "skip" / "close" inside a big fixed overlay (an intro, a promo). Returns what was clicked. */
export const SKIP_OVERLAYS = `(() => {
  const RX = /^(пропустить|skip|s[aă]ri peste|omite|закрыть|close|închide|inchide|×|✕|✖)\\s*(→|›|»)?$/i;
  const done = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < innerWidth * innerHeight * 0.25 || (parseInt(cs.zIndex) || 0) < 100) continue;
    const btn = [...el.querySelectorAll("button, a, [role=button]")].find((b) => RX.test((b.innerText || b.getAttribute("aria-label") || "").trim()));
    if (btn) { done.push((btn.innerText || btn.getAttribute("aria-label")).trim()); btn.click(); }
  }
  return done;
})()`;

/** Native lazy-loading off for every current and future <img> (slideshows swap images in later). */
export const EAGER_IMAGES = `(() => {
  const flip = (root) => root.querySelectorAll?.('img[loading="lazy"]').forEach((i) => { i.loading = "eager"; });
  const before = document.querySelectorAll('img[loading="lazy"]').length;
  flip(document);
  if (!window.__sdEager) {
    window.__sdEager = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === "IMG" && n.loading === "lazy") n.loading = "eager"; flip(n); } });
    window.__sdEager.observe(document.documentElement, { childList: true, subtree: true });
  }
  return before;
})()`;

/** Wait (bounded) until every displayed <img> has decoded and the web fonts are ready. */
export const WAIT_IMAGES = (ms = 8000) => `(async () => {
  const t0 = performance.now();
  const pending = [...document.images].filter((i) => getComputedStyle(i).display !== "none" && (!i.complete || i.naturalWidth === 0));
  await Promise.race([
    Promise.all([document.fonts.ready, ...pending.map((i) => i.decode().catch(() => 0))]),
    new Promise((r) => setTimeout(r, ${ms})),
  ]);
  const still = [...document.images].filter((i) => getComputedStyle(i).display !== "none" && i.getBoundingClientRect().width > 0 && (!i.complete || i.naturalWidth === 0)).map((i) => (i.currentSrc || i.src).slice(-70));
  return { waited: Math.round(performance.now() - t0), pending: pending.length, still };
})()`;

/**
 * Hide what floats over the lower half of the screen — chat bubbles, music and back-to-top
 * buttons, a cookie re-open button, a phone's bottom bar. A capture paints a fixed element where
 * it sits at scroll 0, so left in, it would hang in the middle of the first screen.
 */
export const HIDE_FLOATERS = `(() => {
  if (!document.getElementById("__sd_hide")) { const s = document.createElement("style"); s.id = "__sd_hide"; s.textContent = "[data-sd-hide]{visibility:hidden!important;transition:none!important}"; document.head.appendChild(s); }
  const hidden = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" || cs.display === "none" || el.closest("[data-sd-hide]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.height > 220 || r.top < innerHeight * 0.5) continue;
    el.setAttribute("data-sd-hide", "");
    hidden.push(((el.innerText || "") + " " + (el.getAttribute("aria-label") || el.querySelector("[aria-label]")?.getAttribute("aria-label") || "")).trim().replace(/\\s+/g, " ").slice(0, 40) || String(el.className?.baseVal ?? el.className).slice(0, 40));
  }
  return hidden;
})()`;

/**
 * What a live page shows that is not ours to republish (config.mjs `redact`): a person's name, a
 * face, an e-mail. A `blur` rule blurs what its selector matches — a stylesheet, so a re-render
 * keeps it, and a CSS filter, which changes paint and never layout, so the hotspots stay where
 * they were measured. A `text` rule writes `with` in its place, in the text and in any field, and
 * keeps writing it whatever the page renders later. Returns how many elements each rule reached.
 */
export const REDACT = (rules) => `((rules) => {
  let css = document.getElementById("__sd_redact");
  if (!css) { css = document.createElement("style"); css.id = "__sd_redact"; document.head.appendChild(css); }
  css.textContent = rules.filter((r) => r.blur).map((r) => r.blur + "{filter:blur(" + (r.px || 6) + "px)!important}").join("\\n");
  const swap = () => {
    let n = 0;
    for (const r of rules.filter((r) => r.text)) {
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = walk.nextNode(); t; t = walk.nextNode()) {
        if (t.nodeValue.includes(r.text)) { t.nodeValue = t.nodeValue.split(r.text).join(r.with); n++; }
      }
      for (const f of document.querySelectorAll("input, textarea")) {
        if (f.value.includes(r.text)) { f.value = f.value.split(r.text).join(r.with); n++; }
      }
    }
    return n;
  };
  const counts = rules.map((r) => {
    if (r.blur) return document.querySelectorAll(r.blur).length;
    let n = 0;
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) if (t.nodeValue.includes(r.text)) n++;
    for (const f of document.querySelectorAll("input, textarea")) if (f.value.includes(r.text)) n++;
    return n;
  });
  swap();
  if (!window.__sdRedact && rules.some((r) => r.text)) {
    window.__sdRedact = new MutationObserver(swap);
    window.__sdRedact.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  return counts;
})(${JSON.stringify(rules.map((r) => ({ blur: r.blur, px: r.px, text: r.text, with: r.with })))})`;

/** Whether any `text` rule's words are still on the page (checked once the capture is taken). */
export const REDACT_LEFT = (rules) => `((texts) => {
  const body = document.body.innerText;
  const fields = [...document.querySelectorAll("input, textarea")].map((f) => f.value).join("\\n");
  return texts.filter((t) => body.includes(t) || fields.includes(t));
})(${JSON.stringify(rules.filter((r) => r.text).map((r) => r.text))})`;

/** Mark decorative fixed full-screen layers (no text) as [data-sd-bg]: they get rebuilt as tiles. */
export const MARK_BG = `(() => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.left > 2 || r.top > 2 || r.width < innerWidth * 0.95 || r.height < innerHeight * 0.95) continue;
    if ((el.innerText || "").trim().length > 3 || el.closest("[data-sd-bg]")) continue;
    el.setAttribute("data-sd-bg", "");
    out.push(el.tagName.toLowerCase() + "." + String(el.className?.baseVal ?? el.className).slice(0, 40));
  }
  return out;
})()`;

/** Show only the [data-sd-bg] layers (for a tile capture), or undo that. */
export const ISOLATE_BG = (on) =>
  on
    ? `(() => { const s = document.createElement("style"); s.id = "__sd_iso"; s.textContent = "body *:not([data-sd-bg]):not([data-sd-bg] *){visibility:hidden!important;transition:none!important}[data-sd-bg]{visibility:visible!important}"; document.head.appendChild(s); return 1; })()`
    : `(() => { document.getElementById("__sd_iso")?.remove(); return 1; })()`;

/** Jump every running finite animation and transition to its end (reveals, cross-fades). */
export const FINISH_ANIMS = `(() => {
  let n = 0;
  for (const a of document.getAnimations()) {
    const t = a.effect?.getComputedTiming?.();
    if (!t || t.iterations === Infinity || a.playState === "finished") continue;
    try { a.finish(); n++; } catch { /* an animation without an end */ }
  }
  return n;
})()`;

/** Effective opacity of every visible, sizeable <img> — two equal samples mean nothing is mid-fade. */
export const IMG_OPACITY = `(() => {
  const out = {};
  for (const i of document.images) {
    const r = i.getBoundingClientRect();
    if (r.width * r.height < 10000) continue;
    let op = 1, vis = true;
    for (let e = i; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); op *= parseFloat(cs.opacity); if (cs.display === "none") { vis = false; break; } }
    if (vis) out[(i.currentSrc || i.src).slice(-40) + "@" + Math.round(r.x) + "," + Math.round(r.y + scrollY)] = +op.toFixed(3);
  }
  return out;
})()`;

/**
 * Stop the page's JS slideshows where they are. balloonsbreeze's about photo and its six gallery
 * slots walk one photo list on their own clocks, and within ~15 s of a load the clocks drift into
 * step until most slots show the same photo — so every timer is cleared seconds after the load.
 * Its balloons are requestAnimationFrame-driven and keep floating.
 */
export const STOP_TIMERS = `(() => {
  const last = setTimeout(() => {}, 0);
  for (let id = 1; id <= last; id++) { clearTimeout(id); clearInterval(id); }
  return last;
})()`;

/** What language the page shows: html lang, title, headings, nav, letter counts. */
export const LANG_STATE = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const t = (el, n = 90) => (el.innerText || "").trim().replace(/\\s+/g, " ").slice(0, n);
  const body = document.body.innerText || "";
  return {
    url: location.href, htmlLang: document.documentElement.lang, title: document.title.slice(0, 120),
    h1: [...document.querySelectorAll("h1")].filter(vis).map((e) => t(e)).slice(0, 3),
    h2: [...document.querySelectorAll("h2")].filter(vis).map((e) => t(e, 70)).slice(0, 10),
    nav: [...document.querySelectorAll("header a, header button, nav a, nav button")].filter(vis).map((e) => t(e, 30)).filter(Boolean).slice(0, 14),
    cyr: (body.match(/[\\u0400-\\u04FF]/g) || []).length,
    ro: (body.match(/[ăâîșțşţĂÂÎȘȚŞŢ]/g) || []).length,
  };
})()`;

/** The centre of the site's own "RO" control in the top band, or null. */
export const RO_CONTROL = `(() => {
  const c = [...document.querySelectorAll("a, button, [role=button], [role=option], [role=menuitem], li, span")].filter((el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return /^ro$/i.test((el.innerText || "").trim()) && r.width > 0 && r.height > 0 && r.top < 160 && cs.visibility !== "hidden";
  }).sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
  const el = c.find((e) => e.matches("a, button, [role=button], [role=option], [role=menuitem]")) || c[0];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
})()`;

/** Document y and scroll-margin-top of every element with an id (where an in-page link lands). */
export const IDS = `(() => {
  const o = {};
  for (const e of document.querySelectorAll("[id]")) {
    if (e.id.startsWith("__") || !e.getClientRects().length) continue;
    o[e.id] = { y: Math.round(e.getBoundingClientRect().top + scrollY), smt: parseFloat(getComputedStyle(e).scrollMarginTop) || 0 };
  }
  return o;
})()`;

/**
 * The header band that stays put while the page scrolls: full-width fixed (or sticky) elements
 * at the very top, 20-220 px tall, that are still at the top after a real scroll — a header that
 * hides on the way down is not pinned. Returns its bottom at scroll 0 (CSS px), 0 for none.
 */
export const PIN_BAND = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const cand = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05 || el.closest("[data-sd-hide], [data-sd-bg]")) continue;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.top) > 1 || r.width < innerWidth * 0.8 || r.height < 20 || r.height > 220) continue;
    cand.push({ el, sticky: cs.position === "sticky" });
  }
  if (!cand.length) return { bottom: 0, els: [] };
  const max = document.scrollingElement.scrollHeight - innerHeight;
  let pinned = cand.filter((c) => !c.sticky);
  if (max > 300) {
    window.scrollTo({ top: Math.min(1500, max), behavior: "instant" });
    await wait(450);
    pinned = cand.filter((c) => Math.abs(c.el.getBoundingClientRect().top) <= 1);
    window.scrollTo({ top: 0, behavior: "instant" });
    await wait(450);
  }
  const bottom = Math.max(0, ...pinned.map((c) => c.el.getBoundingClientRect().bottom));
  return { bottom: Math.round(bottom), els: pinned.map((c) => c.el.tagName.toLowerCase() + "." + String(c.el.className?.baseVal ?? c.el.className).slice(0, 30)) };
})()`;

/**
 * Page-side: every visible thing a visitor can press, in document coordinates (CSS px) of the
 * state the capture is taken in (scroll 0 — where a capture paints a fixed header).
 *
 * Candidates are the semantic controls (links, buttons, fields, ARIA widgets, labels, summary,
 * [onclick], tabindex >= 0), elements with a React / Vue / jQuery click handler, and the
 * top-most element of every `cursor: pointer` subtree. A non-semantic element inside a semantic
 * one is the same control; one that only wraps a control, or covers most of the screen, is not
 * one. Each rectangle is cut by every clipping ancestor and by the page; hidden, transparent,
 * `pointer-events: none` and zero-size ones are dropped. A link that wraps over two lines keeps
 * one rectangle per line (`frags`), so the words between them are not part of it.
 */
function surveyInteractive() {
  const se = document.scrollingElement || document.documentElement;
  const VW = innerWidth;
  const DH = se.scrollHeight;
  const sx = scrollX;
  const sy = scrollY;
  const SEM = 'a[href], button, input:not([type=hidden]), select, textarea, summary, label, [role=button], [role=link], [role=tab], [role=menuitem], [role=menuitemradio], [role=option], [role=switch], [role=checkbox], [role=radio], [role=combobox], [role=slider], [contenteditable=""], [contenteditable=true]';
  const EXTRA = '[onclick], [tabindex]:not([tabindex="-1"]), a:not([href])';
  const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const injected = (el) => typeof el.id === "string" && el.id.startsWith("__sd");
  for (const e of document.querySelectorAll("[data-sd-hs]")) e.removeAttribute("data-sd-hs");
  const reactProps = (el) => {
    for (const k in el) if (k.startsWith("__reactProps$") || k.startsWith("__reactEventHandlers$")) return el[k];
    return null;
  };
  const handlerOf = (el) => {
    const rp = reactProps(el);
    if (rp && (rp.onClick || rp.onMouseDown || rp.onPointerDown || rp.onPointerUp || rp.onTouchStart)) return "react";
    if (el._vei && (el._vei.onClick || el._vei.onMousedown || el._vei.onPointerdown)) return "vue";
    if (window.jQuery) {
      try {
        const ev = window.jQuery._data(el, "events");
        if (ev && (ev.click || ev.mousedown || ev.touchstart)) return "jquery";
      } catch {
        /* not a jQuery-managed node */
      }
    }
    if (el.onclick || el.hasAttribute("onclick")) return "onclick";
    return null;
  };
  const cand = new Set([...document.querySelectorAll(SEM + ", " + EXTRA)].filter((el) => !el.closest('[id^="__sd"]')));
  const semantic = (el) => el.matches(SEM);
  for (const el of document.querySelectorAll("body *")) {
    if (cand.has(el) || el.closest('[id^="__sd"]')) continue;
    if (handlerOf(el)) {
      cand.add(el);
      continue;
    }
    if (getComputedStyle(el).cursor !== "pointer") continue;
    const p = el.parentElement;
    if (p && p !== document.body && getComputedStyle(p).cursor === "pointer") continue;
    cand.add(el);
  }
  const list = [...cand];
  const semSet = new Set(list.filter(semantic));
  const inSemantic = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (semSet.has(p)) return true;
    return false;
  };
  const visRect = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible" || cs.pointerEvents === "none") return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom, op = 1, fixed = false, sticky = false;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const pc = getComputedStyle(p);
      if (pc.display === "none") return null;
      op *= parseFloat(pc.opacity);
      if (pc.position === "fixed") fixed = true;
      if (pc.position === "sticky") sticky = true;
      if (p !== el && p !== document.body && (pc.overflowX !== "visible" || pc.overflowY !== "visible" || pc.clipPath !== "none")) {
        const pr = p.getBoundingClientRect();
        if (pc.overflowX !== "visible" || pc.clipPath !== "none") { x0 = Math.max(x0, pr.left); x1 = Math.min(x1, pr.right); }
        if (pc.overflowY !== "visible" || pc.clipPath !== "none") { y0 = Math.max(y0, pr.top); y1 = Math.min(y1, pr.bottom); }
      }
    }
    if (op < 0.05) return null;
    const X0 = Math.max(0, x0 + sx), Y0 = Math.max(0, y0 + sy), X1 = Math.min(VW, x1 + sx), Y1 = Math.min(DH, y1 + sy);
    if (X1 - X0 < 2 || Y1 - Y0 < 2) return null;
    return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0, fullH: r.height, fullW: r.width, fixed, sticky };
  };
  const words = (el) => {
    const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    let field = "";
    if (isField) {
      const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      field = clean(ids.map((id) => document.getElementById(id)?.innerText ?? "").join(" "));
      if (!field && el.labels) field = clean([...el.labels].map((l) => l.innerText).join(" "));
    }
    const h = el.querySelector("h1, h2, h3, h4, h5, h6, [role=heading]");
    return {
      vis: isField ? "" : clean(el.innerText).slice(0, 300),
      aria: clean(el.getAttribute("aria-label")),
      title: clean(el.getAttribute("title")),
      alt: clean(el.tagName === "IMG" ? el.alt : el.querySelector("img[alt]")?.alt),
      svg: clean(el.querySelector("svg title")?.textContent),
      inner: clean(el.querySelector("[aria-label]")?.getAttribute("aria-label")),
      heading: h ? clean(h.innerText).slice(0, 200) : "",
      field: field.slice(0, 200),
      placeholder: clean(el.getAttribute("placeholder")),
      value: el.tagName === "INPUT" && /^(submit|button|reset)$/i.test(el.type) ? clean(el.value) : "",
      name: clean(el.getAttribute("name")),
    };
  };
  const zoneOf = (el, vr) => {
    if (el.closest("footer, [role=contentinfo]")) return "footer";
    if (el.closest("header, [role=banner]")) return "header";
    if (vr.fixed && vr.y - sy < 140) return "header";
    if (el.closest("nav") && vr.y < 160) return "header";
    if (vr.y < 110) return "header";
    if (el.closest("nav")) return "nav";
    return "main";
  };
  const sectionOf = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) if (p.id && /^(SECTION|DIV|MAIN|ARTICLE)$/.test(p.tagName)) return p.tagName.toLowerCase() + "#" + p.id;
    return null;
  };
  const locOf = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      let k = 1;
      for (let s = e.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === e.tagName && !injected(s)) k++;
      parts.unshift(e.tagName.toLowerCase() + ":nth-of-type(" + k + ")");
    }
    return "body > " + parts.join(" > ");
  };
  const out = [];
  const dropped = { nested: 0, wrapper: 0, invisible: 0, tinyInLabel: 0, labelNoControl: 0, giant: 0 };
  for (const el of list) {
    const sem = semantic(el);
    if (!sem && inSemantic(el)) { dropped.nested++; continue; }
    const vr = visRect(el);
    if (!vr) { dropped.invisible++; continue; }
    if (!sem) {
      if (vr.fullH > innerHeight * 1.2 || vr.fullW * vr.fullH > innerWidth * innerHeight * 0.6) { dropped.giant++; continue; }
      const inner = [...el.querySelectorAll(SEM)].map((c) => c.getBoundingClientRect()).filter((c) => c.width * c.height >= 0.8 * vr.fullW * vr.fullH);
      if (inner.length) { dropped.wrapper++; continue; }
    }
    if (el.tagName === "LABEL" && !(el.control || el.querySelector("input, select, textarea"))) { dropped.labelNoControl++; continue; }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      const lab = el.closest("label");
      const lr = lab && lab.getBoundingClientRect();
      if (lr && vr.w * vr.h < 0.25 * lr.width * lr.height) { dropped.tinyInLabel++; continue; }
    }
    const form = el.closest("form");
    const ctl = el.tagName === "LABEL" ? el.control || el.querySelector("input, select, textarea") : null;
    const row = {
      i: out.length,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type"),
      inputType: el.tagName === "INPUT" ? el.type : null,
      role: el.getAttribute("role"),
      ...words(el),
      href: el.tagName === "A" ? el.getAttribute("href") : null,
      abs: el.tagName === "A" && el.href ? el.href : null,
      target: el.getAttribute("target"),
      download: el.hasAttribute("download"),
      sem,
      handler: handlerOf(el),
      haspopup: el.getAttribute("aria-haspopup"),
      expanded: el.getAttribute("aria-expanded"),
      controls: el.getAttribute("aria-controls"),
      inForm: !!form,
      labelFor: ctl ? (ctl.tagName === "INPUT" ? ctl.type : ctl.tagName.toLowerCase()) : null,
      disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true",
      cls: String(el.className?.baseVal ?? el.className).slice(0, 80),
      zone: zoneOf(el, vr),
      section: sectionOf(el),
      x: +vr.x.toFixed(2), y: +vr.y.toFixed(2), w: +vr.w.toFixed(2), h: +vr.h.toFixed(2),
      fixed: vr.fixed,
      sticky: vr.sticky,
      loc: locOf(el),
    };
    const cr = [...el.getClientRects()].filter((q) => q.width >= 2 && q.height >= 2);
    if (cr.length > 1 && getComputedStyle(el).display === "inline") row.frags = cr.map((q) => ({ x: +(q.left + sx).toFixed(2), y: +(q.top + sy).toFixed(2), w: +q.width.toFixed(2), h: +q.height.toFixed(2) }));
    el.setAttribute("data-sd-hs", String(out.length));
    out.push(row);
  }
  // a label's own field, when the field is a control of its own
  for (const row of out) {
    if (row.tag !== "label") continue;
    const el = document.querySelector('[data-sd-hs="' + row.i + '"]');
    const c = el && (el.control || el.querySelector("input, select, textarea"));
    const idx = c && c.getAttribute("data-sd-hs");
    row.ctl = idx == null ? null : Number(idx);
  }
  return {
    url: location.href,
    title: document.title,
    docH: DH,
    vw: VW,
    items: out,
    dropped,
    spt: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
    headings: [...document.querySelectorAll("h1, h2")].filter((e) => e.getClientRects().length).slice(0, 6).map((e) => ({ tag: e.tagName.toLowerCase(), text: clean(e.innerText).slice(0, 120), raw: clean(e.textContent).slice(0, 120) })),
  };
}
export const SURVEY = `(${surveyInteractive.toString()})()`;

/** The text a control is recognised by again on a fresh load (its first 40 visible characters). */
export const keyText = (it) => (it.vis || it.aria || it.title || it.alt || it.placeholder || it.value || "").slice(0, 40);

/**
 * Find a surveyed control on a fresh load and mark it [data-sd-probe]: its element path first,
 * else the same tag with the same text nearest to where it was. Returns how it was found.
 */
export const LOCATE = (it) => `(() => {
  const want = ${JSON.stringify({ loc: it.loc, tag: it.tag, key: keyText(it), y: it.y })};
  const clean = (s) => String(s ?? "").replace(/\\s+/g, " ").trim();
  const isField = (el) => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
  const key = (el) => ((isField(el) ? "" : clean(el.innerText)) || clean(el.getAttribute("aria-label")) || clean(el.getAttribute("title")) || clean(el.querySelector?.("img[alt]")?.alt) || clean(el.getAttribute("placeholder")) || (el.tagName === "INPUT" && /^(submit|button|reset)$/i.test(el.type) ? clean(el.value) : "")).slice(0, 40);
  const ok = (el) => el && el.tagName.toLowerCase() === want.tag && key(el) === want.key;
  for (const e of document.querySelectorAll("[data-sd-probe]")) e.removeAttribute("data-sd-probe");
  let el = null, how = null;
  try { el = document.querySelector(want.loc); } catch { el = null; }
  if (ok(el)) how = "path";
  else if (want.key) {
    // by its words, near where it was: a control without words, or one whose only namesake is
    // half a screen away (a gallery's caption that rotated onto another "21 Марта"), is not found
    const y = (e) => e.getBoundingClientRect().top + scrollY;
    el = [...document.querySelectorAll(want.tag)].filter((e) => ok(e) && Math.abs(y(e) - want.y) <= innerHeight / 2).sort((a, b) => Math.abs(y(a) - want.y) - Math.abs(y(b) - want.y))[0] || null;
    if (el) how = "text";
  } else el = null;
  if (!el) return null;
  el.setAttribute("data-sd-probe", "");
  return how;
})()`;

/** Where to press the marked control: a point of its visible part that really hits it. */
export const HIT_POINT = `(() => {
  const el = document.querySelector("[data-sd-probe]");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const x0 = Math.max(0, r.left), x1 = Math.min(innerWidth, r.right), y0 = Math.max(0, r.top), y1 = Math.min(innerHeight, r.bottom);
  if (x1 - x0 < 1 || y1 - y0 < 1) return { x: 0, y: 0, ok: false, off: true };
  for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.5, 0.7]]) {
    const x = x0 + (x1 - x0) * fx, y = y0 + (y1 - y0) * fy;
    const h = document.elementFromPoint(x, y);
    if (h && (h === el || el.contains(h) || h.contains(el))) return { x, y, ok: true };
  }
  const h = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, ok: false, hit: h ? h.tagName + "." + String(h.className?.baseVal ?? h.className).slice(0, 40) : null };
})()`;

/**
 * A snapshot of what a press can change: the address, the scroll, dialogs and big overlays,
 * the scroll lock, the page's text, the pressed control's ARIA state, its section's content
 * and horizontal scroll (a carousel), and the focused element.
 *
 * `chain` fingerprints the control and each of its ancestors up to its section (the first one
 * with 300 characters of text): the lowest entry that differs between two snapshots is how close
 * to the control a change happened — a revealed tooltip changes entry 0 or 1, a slideshow across
 * the page only the last ones.
 */
export const PROBE_STATE = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.05; };
  const t = (el, n = 100) => ((el.innerText || el.getAttribute("aria-label") || "") + "").trim().replace(/\\s+/g, " ").slice(0, n);
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  const fp = (n) => hash((n.innerText || "") + [...n.querySelectorAll("img")].map((i) => i.currentSrc || i.src).join("|") + [n, ...n.querySelectorAll("*")].slice(0, 400).map((e) => (e.className?.baseVal ?? e.className) + (e.getAttribute("style") || "") + (e.getAttribute("aria-hidden") || "")).join("|"));
  const el = document.querySelector("[data-sd-probe]");
  let sec = el; while (sec && sec.parentElement && (sec.innerText || "").length < 300) sec = sec.parentElement;
  const chain = [];
  for (let e = el; e && chain.length < 40; e = e.parentElement) { chain.push(fp(e)); if (e === sec) break; }
  const dialogs = [...document.querySelectorAll("dialog[open], [role=dialog], [role=alertdialog], [aria-modal=true]")].filter(vis).map((d) => t(d, 140));
  const overlays = [];
  for (const o of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(o);
    if (cs.position !== "fixed" || !vis(o) || o.closest("[data-sd-hide]")) continue;
    const r = o.getBoundingClientRect();
    if (r.width * r.height < innerWidth * innerHeight * 0.12) continue;
    if (o.parentElement && getComputedStyle(o.parentElement).position === "fixed") continue;
    overlays.push(String(o.className?.baseVal ?? o.className).slice(0, 40) + " :: " + t(o, 120));
  }
  const a = document.activeElement;
  return {
    url: location.href, sy: Math.round(scrollY), sh: document.scrollingElement.scrollHeight,
    bodyOv: getComputedStyle(document.body).overflowY, htmlOv: getComputedStyle(document.documentElement).overflowY,
    dialogs, overlays, textLen: (document.body.innerText || "").length,
    active: a && a !== document.body ? a.tagName + "." + String(a.className?.baseVal ?? a.className).slice(0, 30) : "BODY",
    el: el ? { exp: el.getAttribute("aria-expanded"), sel: el.getAttribute("aria-selected"), pressed: el.getAttribute("aria-pressed"), cls: String(el.className?.baseVal ?? el.className).slice(0, 80), checked: el.checked ?? el.querySelector?.("input")?.checked ?? null } : null,
    chain,
    secHash: chain.length ? chain[chain.length - 1] : 0,
    secLen: sec ? (sec.innerText || "").length : 0,
    secScroll: sec ? [sec, ...sec.querySelectorAll("*")].slice(0, 600).reduce((n, e) => n + (e.scrollWidth > e.clientWidth + 4 ? Math.round(e.scrollLeft) : 0), 0) : 0,
  };
})()`;
