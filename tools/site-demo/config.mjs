/**
 * The sites the tool captures, the pages of each demo, and the two layouts.
 *
 * A page set is the few pages of a site worth switching between on /portofoliu's screen. A link
 * to one of them switches the screen; a link to any other page of the site asks the visitor to
 * open the real one (lib/siteDemo.ts). Page ids are what the manifest and the file names use.
 */

/**
 * desktop: a 1440 × 900 screen at dpr 1, captured at 0.75 → 1080 px wide.
 * phone:   a 390 × 844 screen at dpr 2 → 780 px wide.
 * Shot units are the layout's CSS px either way; `maxH` cuts a long page (CSS px), which keeps a
 * phone shot under WebP's 16 383 px limit (8000 × 2 = 16 000).
 */
export const LAYOUTS = {
  desktop: { key: "d", width: 1440, height: 900, dpr: 1, mobile: false, scale: 0.75, maxH: 9000 },
  phone: { key: "m", width: 390, height: 844, dpr: 2, mobile: true, scale: 1, maxH: 8000 },
};

/** Visible text of the surveyed control (see page.mjs SURVEY), for the label rules below. */
const text = (it) => it.vis || it.aria || it.title || "";

/**
 * Per site:
 *  · project — the project's id in lib/content.ts: files go to public/projects/demo/<project>/;
 *  · startShot — the start page's desktop shot, which is also the project's `fullPage`, so the
 *    screen's plain scroll-through and the demo show the same picture;
 *  · lang — how the site is switched to Romanian (its own stored choice, or its RO control on a
 *    desktop) and what proves it worked (the language state of page.mjs LANG_STATE);
 *  · pages — the demo's pages, the start page first; `title` is the site's own text for that
 *    page (a heading or its menu label) where the document title says nothing (cgam names every
 *    page "IQ-Arena") or is not Romanian (balloonsbreeze's stays Russian);
 *  · fold — routes that are a state of a page in the set: the screen opens that page where the
 *    live site lands (bizcheck's ?tab= opens the home page at its catalog); `id` is the fallback
 *    when no landing was measured;
 *  · contacts — the business's own public e-mails and phones: the only ones a label may carry;
 *  · labels — names for controls that show no text and carry no aria-label or title;
 *  · redact — what the live pages show that is not ours to republish (docs/09: never a real
 *    client's names, e-mails or faces): `blur` a selector (`px`, 6 by default) or swap a `text`
 *    `with` another, on every page or only `on` some; a rule that `must` reach a page and finds
 *    nothing there stops that page — the site changed under it, and nothing is published.
 */
export const SITES = {
  bizcheck: {
    project: "bizcheck",
    origin: "https://bizcheck.md",
    startShot: "/projects/bizcheck-site.webp",
    lang: {
      store: ["bizcheck_lang", "ro"],
      control: true,
      ok: (s) => s.htmlLang === "ro" && /Business Checkup/.test(s.h1.join(" ")),
    },
    // the document titles run long ("Bizcheck.md · Evaluarea riscurilor afacerii · Crowe Turcan
    // Mikhailenko"): the list in the screen's bar takes their first part, or the page's own h1
    pages: [
      { id: "acasa", path: "/", title: "Bizcheck.md · Evaluarea riscurilor afacerii" },
      { id: "test", path: "/test/bizcheck", title: "Evaluarea riscurilor afacerii dumneavoastră" },
      { id: "confidentialitate", path: "/confidentialitate", title: "Politica de confidențialitate" },
    ],
    fold: {
      "/?tab=tests": { page: "acasa", id: "resurse" },
      "/?tab=templates": { page: "acasa", id: "resurse" },
    },
    contacts: ["office@bizcheck.md", "+373 79 027 317"],
    labels: [],
  },

  "itara-global": {
    project: "itara-global",
    origin: "https://itara-global.md",
    startShot: "/projects/itara-site.webp",
    lang: { ok: (s) => s.h2.some((h) => /Servicii IT/.test(h)) },
    pages: [{ id: "acasa", path: "/", title: "Itara Solutions" }],
    contacts: ["itarasolutionssrl@gmail.com", "+373 60 855 017"],
    labels: [],
  },

  cgam: {
    project: "cgam",
    origin: "https://cgam.md",
    startShot: "/projects/cgam-site.webp",
    lang: { ok: (s) => s.h2.some((h) => /VE[ȚŢT]I [ÎI]NV[ĂA][ȚŢT]A/i.test(h)) },
    pages: [
      { id: "acasa", path: "/", title: "Acasă" },
      { id: "arena", path: "/arena", title: "Despre IQ Arena" },
      { id: "liga", path: "/liga", title: "Liga" },
      { id: "eveniment", path: "/blog/1", title: "Evenimente" },
      { id: "autentificare", path: "/autentificare", title: "Autentificare" },
      { id: "inregistrare", path: "/inregistrare", title: "Înregistrare" },
    ],
    contacts: [],
    // The league is its players by name and points — the podium on the home page and IQ Arena's,
    // the whole table on /liga — and an event's photo is its participants' faces: all blurred. The
    // IQ Arena mockup's sign-in carries a real address, the one its own screenshot here was
    // cleaned of (public/projects/iq-arena-1.png).
    redact: [
      { blur: "table tbody td:nth-child(2)", on: ["liga"], must: ["liga"] },
      { blur: ".items-end > .flex-col > span.font-medium", on: ["acasa", "arena"], must: ["acasa", "arena"] },
      { blur: "article img", px: 14, on: ["eveniment"], must: ["eveniment"] },
      { text: "andrei@cgam.md", with: "demo@example.com", must: ["arena"] },
    ],
    labels: [
      // the header's phone icon: no text, no aria-label; hovering it shows the number
      { when: (it) => it.zone === "header" && it.tag === "div" && !text(it), t: "Telefon" },
      // the eye in a password field
      { page: "autentificare", when: (it) => it.tag === "button" && !text(it), t: "Arată parola" },
      { page: "inregistrare", when: (it) => it.tag === "button" && !text(it), t: "Arată parola" },
    ],
  },

  "balloons-breeze": {
    project: "balloons-breeze",
    origin: "https://balloonsbreeze.md",
    startShot: "/projects/balloons-breeze-site.webp",
    lang: {
      store: ["bb_lang", "ro"],
      control: true,
      ok: (s) => s.htmlLang === "ro" && /Sute de detalii/.test(s.h1.join(" ")),
    },
    // An intro plays on every full load ("SĂRI PESTE →"); the slideshows are stopped where they
    // are; the sky and the balloon canvas are rebuilt apart (fixes.mjs).
    intro: true,
    stopTimers: true,
    layered: true,
    pages: [{ id: "acasa", path: "/", title: "Balloons Breeze" }],
    contacts: ["balloonsbreeze@gmail.com", "+373 76 616 384"],
    labels: [],
  },
};

export { text };
