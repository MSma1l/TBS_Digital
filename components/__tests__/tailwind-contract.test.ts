/**
 * Contract for Tailwind on this site: `app/tailwind.css` and the files it scans.
 *
 * Tailwind fails silently. A misspelled `@source` path generates no CSS and no error; a
 * `text-[#fff]` or a `dark:` variant builds fine and simply bypasses the tokens and the
 * theme mechanism; `outline-none` builds fine and removes the keyboard focus ring. None of
 * that shows up in `next build` or in the jsdom tests (vitest runs with `css: false`), so
 * the rules from docs/07 are read straight out of the source here:
 *
 *   1. the entry keeps its shape — no preflight, automatic detection off, the same layer
 *      order as globals.css;
 *   2. every `@source` path exists;
 *   3. a scanned file is pure Tailwind: no CSS Module next to the utilities (unlayered
 *      module CSS beats any utility, so mixing the two fails silently);
 *   4. inside class strings: no `!` modifier and no `!important` in an arbitrary value, no raw
 *      colour (hex, a colour function, or a CSS named colour inside `[...]`), no `dark:`, no
 *      `disp` / `mono` / `container` helper, and no outline removal (`outline-none`,
 *      `outline-hidden`, `outline-0`, `[outline:none]`, `[outline:0]`) unless the same class
 *      string draws a real `focus-visible:` outline or ring — one that removes it again
 *      (`focus-visible:outline-transparent`, `focus-visible:ring-0`…) does not count;
 *   5. no `.tsx` outside `@source` writes variant-prefixed utilities (`md:flex`): Tailwind
 *      would never see them, so they would silently do nothing.
 *
 * Arbitrary geometry and typography values (`gap-[18px]`, `text-[clamp(...)]`) are allowed.
 * Masks are the one place a `#000` / `black` is legitimate (alpha only) — they live in
 * `@utility` blocks in app/tailwind.css, never in a class string.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { posix, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ENTRY = "app/tailwind.css";

/**
 * Listed in `@source` ahead of the stage that creates them. Tailwind accepts a source path
 * that does not exist yet (verified: `next build` passes and simply scans nothing there), so
 * the list can be written once. Drop an entry when its file lands.
 */
const NOT_YET_CREATED = new Set<string>([]);

/**
 * Scanned files that still render through a CSS Module, until they are rewritten in
 * Tailwind. The class-string rules skip them (they use the global `container` / `disp` /
 * `mono` helpers today, legitimately). A listed file that no longer imports a module fails,
 * so the rules switch on the moment its rewrite lands.
 */
const LEGACY_MODULE_FILES = new Set<string>([]);

/** Global helpers from globals.css that fight utilities on the same element. */
const GLOBAL_HELPERS = new Set(["disp", "mono", "container"]);

const read = (repoPath: string) => readFileSync(resolve(ROOT, repoPath), "utf8");
const stripCssComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The body of the first `{…}` block opening at or after `from` (nested blocks kept whole). */
function blockBody(css: string, from: number): string | null {
  const open = css.indexOf("{", from);
  if (from < 0 || open < 0) return null;
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  return null;
}

/** How many blocks enclose `index` (0: the top level of the stylesheet). */
const depthAt = (css: string, index: number) =>
  [...css.slice(0, index)].reduce((depth, ch) => depth + (ch === "{" ? 1 : ch === "}" ? -1 : 0), 0);

/** The plain `@source "<path>";` lines, as repo-relative POSIX paths. */
function sourcePaths(css: string): string[] {
  const paths: string[] = [];
  for (const m of stripCssComments(css).matchAll(/@source\s+(["'])([^"']+)\1\s*;/g)) {
    paths.push(posix.normalize(posix.join("app", m[2])));
  }
  return paths;
}

function listCodeFiles(repoPath: string): string[] {
  const abs = resolve(ROOT, repoPath);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return /\.tsx?$/.test(abs) ? [repoPath] : [];
  return readdirSync(abs, { withFileTypes: true }).flatMap((entry) =>
    listCodeFiles(posix.join(repoPath, entry.name)),
  );
}

// --- class-string scanner -------------------------------------------------------------------
// A small lexer rather than one regex: class strings sit in `className="…"`, in
// `className={cond ? "…" : `…${x}…`}`, in `cn(…)`-style helpers and in `…Class` constants, and
// a regex cannot tell a quote inside a template literal from one that ends it.

type ClassString = {
  line: number;
  text: string;
  /** The JSX opening tag the string is an attribute of, when it is one. */
  tag: string | null;
};

const lineAt = (src: string, index: number) => src.slice(0, index).split("\n").length;

/** Index just past the string or template literal starting at `i`; literal text goes to `out`. */
function readLiteral(src: string, i: number, out: string[]): number {
  const quote = src[i];
  let text = "";
  let j = i + 1;
  while (j < src.length && src[j] !== quote) {
    if (src[j] === "\\") {
      text += src[j + 1] ?? "";
      j += 2;
    } else if (quote === "`" && src[j] === "$" && src[j + 1] === "{") {
      text += " ";
      j = readBalanced(src, j + 1, out);
    } else {
      text += src[j];
      j += 1;
    }
  }
  out.push(text);
  return j + 1;
}

/** Index just past the bracket group opening at `i`, collecting every literal inside. */
function readBalanced(src: string, i: number, out: string[]): number {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    const ch = src[j];
    if (ch === '"' || ch === "'" || ch === "`") {
      j = readLiteral(src, j, out);
      continue;
    }
    if (ch === "/" && src[j + 1] === "/") {
      j = src.indexOf("\n", j) === -1 ? src.length : src.indexOf("\n", j);
      continue;
    }
    if (ch === "/" && src[j + 1] === "*") {
      j = src.indexOf("*/", j) === -1 ? src.length : src.indexOf("*/", j) + 2;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    if (ch === ")" || ch === "]" || ch === "}") {
      depth -= 1;
      if (depth === 0) return j + 1;
    }
    j += 1;
  }
  return j;
}

/** Literals of a `const fooClass = …` initializer, up to the end of the statement. */
function readInitializer(src: string, i: number, out: string[]): void {
  let j = i;
  while (j < src.length) {
    const ch = src[j];
    if (ch === '"' || ch === "'" || ch === "`") {
      j = readLiteral(src, j, out);
    } else if (ch === "(" || ch === "[" || ch === "{") {
      j = readBalanced(src, j, out);
    } else if (ch === ";") {
      return;
    } else if (ch === "\n") {
      const before = src.slice(i, j).trimEnd().slice(-1);
      const after = src.slice(j).trimStart()[0] ?? "";
      if (!"=?:+,(|&".includes(before) && !"?:.+|&".includes(after)) return;
      j += 1;
    } else {
      j += 1;
    }
  }
}

/** The JSX opening tag that contains `index`, or null. */
function enclosingTag(src: string, index: number): string | null {
  for (let start = src.lastIndexOf("<", index); start >= 0; start = src.lastIndexOf("<", start - 1)) {
    if (!/[A-Za-z]/.test(src[start + 1] ?? "")) continue;
    let j = start + 1;
    while (j < src.length && src[j] !== ">") {
      if (src[j] === '"' || src[j] === "'" || src[j] === "`") j = readLiteral(src, j, []);
      else if (src[j] === "{") j = readBalanced(src, j, []);
      else j += 1;
    }
    if (j > index) return src.slice(start, j + 1);
    return null;
  }
  return null;
}

/** `tags: false` skips the enclosing-tag lookup, the slow part, when no rule needs it. */
function scanClassStrings(src: string, { tags = true }: { tags?: boolean } = {}): ClassString[] {
  const found: ClassString[] = [];
  const collect = (index: number, run: (out: string[]) => void, tag: string | null) => {
    const out: string[] = [];
    run(out);
    if (out.length) found.push({ line: lineAt(src, index), text: out.join(" "), tag });
  };

  // JSX attributes: className, and any *ClassName prop.
  for (const m of src.matchAll(/\b\w*[cC]lassName\s*=\s*(?=["'{])/g)) {
    const at = m.index + m[0].length;
    collect(
      m.index,
      (out) => (src[at] === "{" ? readBalanced(src, at, out) : readLiteral(src, at, out)),
      tags ? enclosingTag(src, m.index) : null,
    );
  }
  // Class-joining helpers.
  for (const m of src.matchAll(/\b(?:cn|clsx|cx|twJoin|twMerge)\s*\(/g)) {
    collect(m.index, (out) => readBalanced(src, m.index + m[0].length - 1, out), null);
  }
  // Constants that hold classes: `const barClass = …`, `const CTA_CLASSES = …`.
  for (const m of src.matchAll(
    /\b(?:const|let|var)\s+\w*(?:[cC]lass(?:Name)?(?:es)?|CLASS(?:NAME)?(?:ES)?)\b\s*(?::[^=\n]+)?=\s*/g,
  )) {
    collect(m.index, (out) => readInitializer(src, m.index + m[0].length, out), null);
  }
  return found;
}

/** The utility itself, without its variants (`md:hover:outline-none` → `outline-none`). */
function baseUtility(token: string): string {
  let depth = 0;
  let cut = 0;
  for (let i = 0; i < token.length; i += 1) {
    if (token[i] === "[" || token[i] === "(") depth += 1;
    else if (token[i] === "]" || token[i] === ")") depth -= 1;
    else if (token[i] === ":" && depth === 0) cut = i + 1;
  }
  return token.slice(cut);
}

// No `\b` before the function names: Tailwind writes spaces as `_`, which is a word character.
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}(?![\w-])|(?:^|[^A-Za-z])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/;

/** CSS named colours (CSS Color 4). `transparent`, `currentColor` and `inherit` are allowed. */
const NAMED_COLOURS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue " +
    "blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk " +
    "crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki " +
    "darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue " +
    "dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite " +
    "gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki " +
    "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen " +
    "lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen " +
    "magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
    "mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum " +
    "powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen " +
    "steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
);

/** The `[...]` segments of a utility (nested brackets kept whole), quoted strings removed. */
function arbitraryValues(utility: string): string[] {
  const values: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < utility.length; i += 1) {
    if (utility[i] === "[") {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (utility[i] === "]" && depth > 0) {
      depth -= 1;
      if (depth === 0) values.push(utility.slice(start, i));
    }
  }
  return values.map((value) => value.replace(/(["'])(?:\\.|(?!\1).)*\1/g, " "));
}

/** A CSS named colour written inside an arbitrary value (`text-[white]`, `[color:red]`). */
function namedColourIn(utility: string): string | null {
  for (const value of arbitraryValues(utility)) {
    // Custom property names are not colours: `var(--red)`, `[--accent:var(--blue)]`.
    const words = value.replace(/--[\w-]+/g, " ").split(/[^A-Za-z]+/);
    const hit = words.find((word) => NAMED_COLOURS.has(word.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

/**
 * Utilities that take the outline away. In Tailwind v4 `outline-hidden` is the old
 * `outline-none` (a transparent 2px outline) and `outline-none` really removes it — for the
 * keyboard both mean "no visible ring", so both need a focus-visible replacement.
 */
const OUTLINE_REMOVAL = /^(?:outline-(?:none|hidden|0|\[0(?:px)?\])|\[outline:(?:none|0(?:px)?)\])$/;

/**
 * A focus-visible style that really draws a ring. Offsets alone draw nothing, and the
 * values that remove an outline or a ring again are not a ring.
 */
function isFocusVisibleRing(token: string): boolean {
  const match = /(?:^|:)focus-visible:(.+)$/.exec(token);
  if (!match) return false;
  const utility = match[1];
  if (OUTLINE_REMOVAL.test(utility)) return false;
  if (/^(?:outline|ring)-offset(?:-|$)/.test(utility)) return false;
  if (/^outline-transparent$/.test(utility)) return false;
  if (/^ring-(?:0|transparent|\[0(?:px)?\])$/.test(utility)) return false;
  return /^(?:outline(?:-|$)|ring(?:-|$)|\[outline:)/.test(utility);
}

/** Every rule a class string can break, as readable messages (empty when clean). */
function classStringViolations({ text, tag }: ClassString): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const problems: string[] = [];
  const hasFocusRing = tokens.some(isFocusVisibleRing);
  const programmaticFocusOnly = tag !== null && /\btabIndex=\{\s*-1\s*\}/.test(tag);

  for (const token of tokens) {
    const base = baseUtility(token);
    if (/(?:^|:)!/.test(token) || token.endsWith("!")) {
      problems.push(
        `"${token}": the ! modifier (a layered !important beats the unlayered ones in globals.css, e.g. the reduced-motion switch)`,
      );
    }
    if (RAW_COLOUR.test(token)) {
      problems.push(`"${token}": a raw colour — use a token utility (bg-red, text-mut…)`);
    }
    const named = namedColourIn(base);
    if (named) {
      problems.push(
        `"${token}": the named colour "${named}" in an arbitrary value — use a token (var(--red), text-mut…)`,
      );
    }
    if (arbitraryValues(base).some((value) => /!\s*important/i.test(value))) {
      problems.push(
        `"${token}": !important in an arbitrary value (it beats the unlayered globals, like the ! modifier)`,
      );
    }
    if (/(?:^|:)dark:/.test(token)) {
      problems.push(`"${token}": dark: — the tokens already follow data-theme`);
    }
    if (GLOBAL_HELPERS.has(base)) {
      problems.push(`"${token}": the global .${base} helper — use utilities (font-disp, font-hud, mx-auto max-w-(--maxw))`);
    }
    if (OUTLINE_REMOVAL.test(base) && !hasFocusRing && !programmaticFocusOnly) {
      problems.push(`"${token}": ${base} without a focus-visible: outline or ring`);
    }
  }
  return problems;
}

// --- the contract ---------------------------------------------------------------------------

const entry = read(ENTRY);
const sources = sourcePaths(entry);
const scanned = [...new Set(sources.flatMap(listCodeFiles))];
const importsModule = (src: string) => /\.module\.css["']/.test(src);

/** Where components live. Tests are not rendered by the site, so they are not included. */
const COMPONENT_ROOTS = ["app", "components", "lib"];

/**
 * A variant-prefixed utility (`md:flex`, `hover:text-txt`, `[&_a]:underline`,
 * `group-hover/cta:translate-x-0.5`). CSS Module class names never contain a colon.
 */
const VARIANT_UTILITY = /^(?:(?:[a-z][\w-]*(?:\/[\w-]+)?|\[[^\]]+\]):)+!?-?[a-z[(]/;

/** Class-string tokens that only Tailwind could give a meaning to. */
function variantUtilities(src: string): string[] {
  return scanClassStrings(src, { tags: false }).flatMap((cls) =>
    cls.text.split(/\s+/).filter((token) => VARIANT_UTILITY.test(token)),
  );
}

describe("app/tailwind.css — the entry", () => {
  it("imports only theme and utilities (no preflight) and turns automatic detection off", () => {
    const css = stripCssComments(entry);
    expect(css).toMatch(/@import\s+["']tailwindcss\/theme\.css["']\s+layer\(theme\)\s*;/);
    expect(css).toMatch(
      /@import\s+["']tailwindcss\/utilities\.css["']\s+layer\(utilities\)\s+source\(none\)\s*;/,
    );
    expect(css).not.toMatch(/@import\s+["']tailwindcss["']/);
    expect(css).not.toMatch(/preflight/);
  });

  it("declares the same layer order as the first line of globals.css", () => {
    const layerStatement = /^\s*(@layer\s+[\w\s,]+;)/m;
    const inEntry = stripCssComments(entry).match(layerStatement)?.[1];
    const globalsFirstLine = read("app/globals.css").split(/\r?\n/)[0];

    expect(inEntry, `${ENTRY} has no @layer statement`).toBeDefined();
    expect(globalsFirstLine.replace(/\s+/g, " ")).toBe(inEntry?.replace(/\s+/g, " "));
  });

  it("keeps Tailwind's container utility off (globals.css owns .container)", () => {
    expect(stripCssComments(entry)).toMatch(/@source\s+not\s+inline\(\s*["']container["']\s*\)\s*;/);
  });
});

describe("app/tailwind.css — @source", () => {
  it("lists at least one source", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it("points only at paths that exist", () => {
    const missing = sources.filter(
      (path) => !NOT_YET_CREATED.has(path) && !existsSync(resolve(ROOT, path)),
    );
    expect(missing, `@source paths in ${ENTRY} that do not exist`).toEqual([]);
  });

  it("allows a missing path only for a source that is still declared", () => {
    const stale = [...NOT_YET_CREATED].filter((path) => !sources.includes(path));
    expect(stale, "NOT_YET_CREATED entries no longer in @source").toEqual([]);
  });
});

/**
 * The services glass reveal (the Directions panel and its copy column). What it keys off is
 * the stage root: `data-entry` exists only on the WebGL path, `data-renderer` everywhere.
 * `pending` must light nothing — it can still turn into WebGL and take the glow away again.
 */
describe("app/tailwind.css — the services glass reveal", () => {
  const css = stripCssComments(entry);
  const glow = blockBody(css, css.search(/@utility\s+entry-glow\s*\{/)) ?? "";
  const sweep = blockBody(css, css.search(/@utility\s+entry-sweep\s*\{/)) ?? "";

  it("lights the panel's edge once the scene formed the model, and statically without WebGL, never while pending", () => {
    expect(glow, "@utility entry-glow").not.toBe("");
    // Only once the stage really is WebGL: the first entry report lands a commit before it says so.
    expect(glow).toMatch(/\[data-scene-stage\]\[data-renderer="webgl"\]\[data-entry="formed"\]\s+&\s*[,{]/);
    expect(glow).not.toMatch(/(^|[\s,{])\[data-entry=/);
    expect(glow).toMatch(/\[data-scene-stage\]\[data-renderer="fallback"\]\s+&\s*[,{]/);
    expect(glow).toMatch(/\[data-scene-stage\]\[data-renderer="off"\]\s+&\s*[,{]/);
    expect(glow).toMatch(/var\(--accent\)/);
    expect(glow).not.toMatch(/pending|data-reveal|intro/);
    // The one transition belongs to the WebGL path: the static glow never animates in.
    expect(glow.match(/\btransition\s*:/g)).toHaveLength(1);
    expect(/([^{}]*)\{[^{}]*\btransition\s*:/.exec(glow)?.[1].trim()).toBe(
      '[data-scene-stage][data-renderer="webgl"] &',
    );
  });

  it("sweeps the copy column's ::after only while the scene bursts and motion is allowed", () => {
    expect(sweep, "@utility entry-sweep").not.toBe("");
    expect(sweep).toMatch(/&::after\s*\{[^{}]*pointer-events:\s*none/);
    expect(sweep).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[\s\S]*\[data-scene-stage\]\[data-renderer="webgl"\]\[data-entry="burst"\]\s+&::after\s*\{[^{}]*animation:\s*hud-glass-sweep\s/,
    );
    expect(sweep.match(/\banimation\s*:/g)).toHaveLength(1);
    expect(sweep).not.toMatch(/pending|data-reveal|intro/);
  });

  it("mixes colours only inside its own color-mix @supports: Tailwind adds no opaque-accent copy", () => {
    const at = glow.search(/@supports\s*\(\s*color:\s*color-mix\(in lab, red, red\)\s*\)\s*\{/);
    const inside = blockBody(glow, at) ?? "";
    expect(inside).toMatch(/border-color:\s*color-mix\(in srgb, var\(--accent\)/);
    expect(glow.replace(inside, "").replace(/@supports[^{]*/, "")).not.toMatch(/color-mix\(/);
    // The band's strength is its opacity, never a mix an engine could fall back from.
    expect(sweep).not.toMatch(/color-mix\(/);
  });

  it("neither blurs nor rounds anything", () => {
    expect(`${glow}${sweep}`).not.toMatch(/filter|blur\(|border-radius/);
  });

  it("keeps hud-glass-sweep at the top level, on transform and opacity only", () => {
    const at = css.search(/@keyframes\s+hud-glass-sweep\s*\{/);
    expect(at, "@keyframes hud-glass-sweep").toBeGreaterThan(-1);
    expect(depthAt(css, at)).toBe(0);
    const body = blockBody(css, at) ?? "";
    const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(properties)).toEqual(new Set(["opacity", "transform"]));
    // The band crosses the copy: at its strongest a 12% tint (the light theme's red tag stays at
    // 4.5:1 or more under it, for every accent), never a stripe over the text.
    const opacities = [...body.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...opacities)).toBeLessThanOrEqual(0.12);
  });
});

describe("scanned files — pure Tailwind", () => {
  it("do not mix a CSS Module with utilities", () => {
    const mixed = scanned.filter(
      (file) => !LEGACY_MODULE_FILES.has(file) && importsModule(read(file)),
    );
    expect(mixed, "Tailwind files that import a *.module.css (delete the module)").toEqual([]);
  });

  it("keep the legacy list honest: a rewritten file leaves it", () => {
    const rewritten = [...LEGACY_MODULE_FILES].filter(
      (file) => !existsSync(resolve(ROOT, file)) || !importsModule(read(file)),
    );
    expect(
      rewritten,
      "no longer on a CSS Module: remove from LEGACY_MODULE_FILES so the class rules apply",
    ).toEqual([]);
  });

  it("are the only .tsx files that write variant-prefixed utilities (the rest would build to nothing)", () => {
    const unscanned = COMPONENT_ROOTS.flatMap(listCodeFiles).filter(
      (file) =>
        file.endsWith(".tsx") && !file.includes("/__tests__/") && !scanned.includes(file),
    );
    expect(unscanned.length, "found no component files to check").toBeGreaterThan(0);
    // The legacy files do write literal class strings (`className="container"`): the check
    // below reads real strings, not an empty scan.
    expect(
      unscanned.some((file) => scanClassStrings(read(file), { tags: false }).length > 0),
    ).toBe(true);

    const outside = unscanned.flatMap((file) =>
      variantUtilities(read(file)).map((token) => `${file}: "${token}"`),
    );
    expect(outside, `utilities in files ${ENTRY} does not list in @source`).toEqual([]);
  });

  it("break none of the class-string rules", () => {
    const violations = scanned
      .filter((file) => !LEGACY_MODULE_FILES.has(file))
      .flatMap((file) =>
        scanClassStrings(read(file)).flatMap((cls) =>
          classStringViolations(cls).map((problem) => `${file}:${cls.line} ${problem}`),
        ),
      );
    expect(violations).toEqual([]);
  });
});

/**
 * The rules above pass trivially while no scanned file is on Tailwind yet, so the scanner is
 * pinned on fixtures: a broken scanner would otherwise let everything through unnoticed.
 */
describe("the class-string scanner", () => {
  const problemsIn = (src: string) =>
    scanClassStrings(src).flatMap((cls) => classStringViolations(cls));

  it("finds class strings in attributes, expressions, templates, helpers and constants", () => {
    const src = [
      `const barClass = "a1"\r\n  + "a2";`,
      `export function X({ open }: { open: boolean }) {`,
      `  return (`,
      `    <div className="b1 b2" innerClassName={'c1'}>`,
      `      <p className={open ? "d1" : \`d2 \${open ? "d3" : ""} d4\`} />`,
      `      <i className={cn("e1", open && "e2")} />`,
      `    </div>`,
      `  );`,
      `}`,
    ].join("\r\n");
    const texts = scanClassStrings(src).map((cls) => cls.text);

    for (const token of ["a1", "a2", "b1", "b2", "c1", "d1", "d2", "d3", "d4", "e1", "e2"]) {
      expect(texts.join(" "), token).toContain(token);
    }
  });

  it("reports the line a class string is on, with CRLF line endings", () => {
    const src = `import x from "y";\r\n\r\nconst A = <p className="text-[#fff]" />;`;
    expect(scanClassStrings(src)[0]?.line).toBe(3);
  });

  it("flags every banned pattern", () => {
    expect(problemsIn(`<p className="bg-red! md:!p-2" />`)).toHaveLength(2);
    expect(
      problemsIn(`<p className="text-[#fff] bg-[rgb(1,2,3)] shadow-[0_0_4px_hsla(0,0%,0%,.5)] fill-[oklch(1_0_0)]" />`),
    ).toHaveLength(4);
    expect(problemsIn(`<p className="dark:bg-void md:dark:text-txt" />`)).toHaveLength(2);
    expect(problemsIn(`<p className="container md:disp mono" />`)).toHaveLength(3);
    expect(problemsIn(`<button className="outline-none focus:outline-none" />`)).toHaveLength(2);
  });

  it("flags CSS named colours inside arbitrary values, including the variant-prefixed ones", () => {
    expect(
      problemsIn(`<p className="text-[white] shadow-[0_0_8px_black] [color:red] from-[aqua]" />`),
    ).toHaveLength(4);
    expect(problemsIn(`<p className="hover:[background:RebeccaPurple] md:border-[Navy]" />`)).toHaveLength(2);
    expect(problemsIn(`<p className="bg-[var(--x,red)]" />`)).toHaveLength(1);
    // A mask belongs in an @utility (app/tailwind.css), never in a class string.
    expect(
      problemsIn(`<p className="[mask-image:linear-gradient(to_bottom,black_55%,transparent)]" />`),
    ).toHaveLength(1);
  });

  it("does not mistake tokens, keywords, custom properties or quoted text for named colours", () => {
    expect(
      problemsIn(
        `<p className="border-[transparent] [color:currentColor] fill-[currentcolor] text-[inherit] [--accent:var(--blue)] bg-[radial-gradient(closest-side,var(--glow-red),transparent)] content-['red'] [--hud-grid-line:color-mix(in_srgb,var(--blue)_42%,transparent)] [animation-play-state:paused]" />`,
      ),
    ).toEqual([]);
  });

  it("flags !important inside an arbitrary value", () => {
    expect(problemsIn(`<p className="[color:var(--txt)!important]" />`)).toHaveLength(1);
    expect(problemsIn(`<p className="md:[animation:none_!important]" />`)).toHaveLength(1);
    // An exclamation mark in generated content is not a priority.
    expect(problemsIn(`<p className="content-['!important']" />`)).toEqual([]);
  });

  it("treats every Tailwind v4 way of removing the outline like outline-none", () => {
    for (const removal of ["outline-hidden", "outline-0", "[outline:none]", "[outline:0]"]) {
      expect(problemsIn(`<button className="${removal}" />`), removal).toHaveLength(1);
      expect(
        problemsIn(`<button className="${removal} focus-visible:outline-2 focus-visible:outline-cyan" />`),
        removal,
      ).toEqual([]);
    }
    expect(problemsIn(`<button className="outline-0 focus-visible:outline-0" />`)).toHaveLength(2);
  });

  it("does not count a focus-visible style that draws no ring as the ring", () => {
    for (const notARing of [
      "focus-visible:outline-none",
      "focus-visible:outline-hidden",
      "focus-visible:outline-0",
      "focus-visible:outline-transparent",
      "focus-visible:outline-offset-2",
      "focus-visible:[outline:none]",
      "focus-visible:ring-0",
      "focus-visible:ring-transparent",
      "focus-visible:ring-offset-2",
    ]) {
      expect(problemsIn(`<button className="outline-none ${notARing}" />`), notARing).not.toEqual([]);
    }
    expect(problemsIn(`<button className="outline-hidden focus-visible:ring" />`)).toEqual([]);
    expect(
      problemsIn(`<button className="outline-none md:focus-visible:[outline:2px_solid_var(--cyan)]" />`),
    ).toEqual([]);
  });

  it("accepts tokens, arbitrary geometry and a focus-visible ring next to outline-none", () => {
    expect(
      problemsIn(
        `<a href="#top" className="bg-void text-red-text gap-[18px] text-[clamp(34px,8.6vw,74px)] shadow-[0_0_8px_var(--cyan)] z-(--z-header) via-red/50 content-['!']" />`,
      ),
    ).toEqual([]);
    expect(
      problemsIn(`<a className="outline-none focus-visible:outline-2 focus-visible:outline-cyan" />`),
    ).toEqual([]);
    expect(problemsIn(`<b className="outline-none focus-visible:ring-2" />`)).toEqual([]);
    // Removing the outline on focus-visible too is not a ring: both tokens are flagged.
    expect(problemsIn(`<b className="outline-none focus-visible:outline-none" />`)).toHaveLength(2);
  });

  it("spots variant-prefixed utilities, and nothing a CSS Module would write", () => {
    expect(
      variantUtilities(
        `<p className="md:flex hover:text-txt group-hover/cta:translate-x-0.5 [&_a]:underline max-md:before:bg-glass-solid" />`,
      ),
    ).toHaveLength(5);
    expect(
      variantUtilities(`<p className={\`\${styles.card} sectionLabel disp mono\`} data-x="a:b" />`),
    ).toEqual([]);
  });

  it("allows outline-none on an element that only takes programmatic focus (tabIndex={-1})", () => {
    expect(problemsIn(`<div role="dialog" tabIndex={-1} className="outline-none" />`)).toEqual([]);
    expect(problemsIn(`<div tabIndex={0} className="outline-none" />`)).toHaveLength(1);
  });
});
