/**
 * The interior stage's source contract — what must hold for the 3D to stay lazy, for
 * ScrollTrigger to stay harmless, and for the static art to stay directive-free. Read straight
 * out of the source, like tailwind-contract.test.ts: none of it shows up in jsdom.
 *
 *   1. no STATIC three / R3F / GSAP import — by package name, by any subpath of one, or through
 *      one of the site's modules that carry them (the 3D runtime, the scene and director
 *      components) — in any module the page bundle reaches (the same file list
 *      eslint.config.mjs bans them in); type-only imports are erased and allowed. They load
 *      through next/dynamic / import();
 *   2. none of ScrollTrigger's page-rewriting features under components/scene/**, nor in the
 *      HUD chrome (components/hud/**, lib/hud/**), which lives over the same scrolling page: no
 *      pinning (spacers shift every anchor), no snapping (inline scroll-behavior on html/body),
 *      no normalizeScroll / ScrollSmoother, no markers, no custom scroller, no lagSmoothing (the
 *      intro director owns GSAP's ticker);
 *   3. the stage is in Tailwind's @source and no art file is (the art is a CSS Module);
 *   4. the art carries no directive: no "use client" in components/scene/art/**. The page
 *      server-renders the hero core and the first direction's drawing; Directions loads
 *      ServiceArt in the browser (next/dynamic) for the other directions, so the same pure
 *      module renders on both sides;
 *   5. lucide-react icons are named imports from the package root, and only the HUD chrome
 *      (components/hud/**) uses them: no dynamic entry point, no dist/* path, no namespace —
 *      each of those keeps every icon (the same bans eslint.config.mjs enforces).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { posix, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (repoPath: string) => readFileSync(resolve(ROOT, repoPath), "utf8");
const withoutComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

function listFiles(repoPath: string, pattern: RegExp): string[] {
  const abs = resolve(ROOT, repoPath);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return pattern.test(repoPath) ? [repoPath] : [];
  return readdirSync(abs, { withFileTypes: true }).flatMap((entry) =>
    listFiles(posix.join(repoPath, entry.name), pattern),
  );
}

const CODE = /\.(?:ts|tsx|mts|js|mjs)$/;

/** eslint.config.mjs's heavy-import block, file for file. */
const PAGE_BUNDLE_ROOTS = [
  "app",
  "components/sections",
  "components/layout",
  "components/ui",
  "components/fx",
  "components/hud",
  "components/scene/SceneStage.tsx",
  "components/scene/art",
  "components/scene/shapes.ts",
  "components/three/RenderErrorBoundary.tsx",
  "components/three/capability.ts",
  "components/intro/IntroPreloader.tsx",
  "components/intro/IntroFallback.tsx",
  "components/intro/lemniscate.ts",
  "components/intro/capability.ts",
  "components/intro/tiers.ts",
  "lib",
];

const HEAVY = ["three", "@react-three/fiber", "gsap", "gsap/ScrollTrigger", "@gsap/react"];
/** Every subpath of a heavy package (eslint.config.mjs `HEAVY_SUBPATHS`). */
const HEAVY_SUBPATHS = ["three/*", "@react-three/fiber/*", "gsap/*", "@gsap/react/*"];
/** The site's own modules that carry them (eslint.config.mjs `HEAVY_MODULES_REGEX`). */
const HEAVY_MODULES = ["three/runtime", "SceneCanvas", "SceneWorld", "SceneDirector", "IntroScene", "IntroDirector"];
const HEAVY_MODULE_PATTERN = new RegExp(`(^|/)(${HEAVY_MODULES.join("|")})(\\.(tsx?|jsx?|mjs))?$`);

function isHeavy(specifier: string): boolean {
  return (
    HEAVY.includes(specifier) ||
    HEAVY_SUBPATHS.some((glob) => specifier.startsWith(glob.slice(0, -1))) ||
    HEAVY_MODULE_PATTERN.test(specifier)
  );
}

/** Static value imports and re-exports (`import type` / `export type` are erased and allowed). */
function staticHeavyImports(src: string): string[] {
  const found: string[] = [];
  const statements = /(?:^|\n)\s*(import|export)\s+(?!type\s)([^;]*?)\s+from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  for (const m of withoutComments(src).matchAll(statements)) {
    const specifier = m[3] ?? m[4];
    if (isHeavy(specifier)) found.push(specifier);
  }
  return found;
}

/** Things ScrollTrigger (or GSAP) may never be asked to do inside the interior stage. */
const FORBIDDEN_SCROLL_FEATURES: Array<[string, RegExp]> = [
  ["pin", /\bpin\s*:/],
  ["pinSpacing", /\bpinSpacing\b/],
  ["pinReparent", /\bpinReparent\b/],
  ["anticipatePin", /\banticipatePin\b/],
  ["snap", /\bsnap\s*:/],
  ["normalizeScroll", /\bnormalizeScroll\b/],
  ["ScrollSmoother", /\bScrollSmoother\b/],
  ["markers", /\bmarkers\s*:/],
  ["scroller", /\bscroller\s*:/],
  ["lagSmoothing", /\blagSmoothing\b/],
];

describe("interior stage — lazy heavy libraries", () => {
  const files = [...new Set(PAGE_BUNDLE_ROOTS.flatMap((root) => listFiles(root, CODE)))].filter(
    (file) => !file.includes("/__tests__/"),
  );

  it("scans the page bundle's modules, the stage shell, the art and the shared maths", () => {
    for (const file of [
      "app/(site)/page.tsx",
      "components/sections/Hero.tsx",
      "components/scene/SceneStage.tsx",
      "components/scene/shapes.ts",
      "components/fx/usePointerTilt.ts",
      "lib/scene.ts",
    ]) {
      expect(files, file).toContain(file);
    }
  });

  it("pins the import detector on fixtures", () => {
    expect(staticHeavyImports(`import gsap from "gsap";`)).toEqual(["gsap"]);
    expect(staticHeavyImports(`import { Canvas } from "@react-three/fiber";`)).toEqual(["@react-three/fiber"]);
    expect(staticHeavyImports(`import {\n  ScrollTrigger,\n} from 'gsap/ScrollTrigger';`)).toEqual(["gsap/ScrollTrigger"]);
    expect(staticHeavyImports(`export { Color } from "three";`)).toEqual(["three"]);
    expect(staticHeavyImports(`import "three";`)).toEqual(["three"]);
    expect(staticHeavyImports(`import type { Color } from "three";`)).toEqual([]);
    expect(staticHeavyImports(`const m = await import("gsap");`)).toEqual([]);
    expect(staticHeavyImports(`// import gsap from "gsap";`)).toEqual([]);
    // A subpath of a heavy package is as heavy as the package (the ban used to be exact names).
    expect(staticHeavyImports(`import { x } from "three/addons/math/ImprovedNoise.js";`)).toEqual([
      "three/addons/math/ImprovedNoise.js",
    ]);
    expect(staticHeavyImports(`import { ScrollTrigger } from "gsap/ScrollTrigger.js";`)).toEqual(["gsap/ScrollTrigger.js"]);
    expect(staticHeavyImports(`import { Observer } from "gsap/Observer";`)).toEqual(["gsap/Observer"]);
    expect(staticHeavyImports(`import * as WEBGPU from "three/webgpu";`)).toEqual(["three/webgpu"]);
    expect(staticHeavyImports(`import { useGSAP } from "@gsap/react/dist";`)).toEqual(["@gsap/react/dist"]);
    // So is a site module that carries them, however it is spelled.
    expect(staticHeavyImports(`import { SceneCanvas } from "@/components/three/runtime";`)).toEqual([
      "@/components/three/runtime",
    ]);
    expect(staticHeavyImports(`import { SceneDirector } from "@/components/scene/SceneDirector";`)).toEqual([
      "@/components/scene/SceneDirector",
    ]);
    expect(staticHeavyImports(`import { SceneWorld } from "../scene/SceneWorld";`)).toEqual(["../scene/SceneWorld"]);
    expect(staticHeavyImports(`export { IntroDirector } from "./IntroDirector.tsx";`)).toEqual(["./IntroDirector.tsx"]);
    // …but not a module that merely shares a prefix, a type-only import, or an import().
    expect(staticHeavyImports(`import { x } from "three-stdlib-free";`)).toEqual([]);
    expect(staticHeavyImports(`import { x } from "@/lib/SceneCanvasProps";`)).toEqual([]);
    expect(staticHeavyImports(`import type { SceneCanvasProps } from "@/components/scene/SceneCanvas";`)).toEqual([]);
    expect(staticHeavyImports(`import type { ScrollTrigger } from "gsap/ScrollTrigger.js";`)).toEqual([]);
    expect(staticHeavyImports(`const m = await import("@/components/three/runtime");`)).toEqual([]);
  });

  it("no module the page bundle reaches imports three, R3F or GSAP statically", () => {
    const offenders = files.flatMap((file) =>
      staticHeavyImports(read(file)).map((specifier) => `${file}: ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it("the ESLint block that enforces it lists the same files and repeats the CSP bans", () => {
    const config = read("eslint.config.mjs");
    for (const root of PAGE_BUNDLE_ROOTS) {
      const glob = CODE.test(root) ? root : `${root}/**`;
      expect(config, glob).toContain(`"${glob}"`);
    }
    for (const specifier of HEAVY) expect(config).toContain(`"${specifier}"`);
    for (const glob of HEAVY_SUBPATHS) expect(config).toContain(`"${glob}"`);
    // The module regex is the detector's, character for character (the config string escapes `\`).
    const regex = config.match(/HEAVY_MODULES_REGEX\s*=\s*"([^"]+)"/)?.[1];
    expect(regex, "HEAVY_MODULES_REGEX").toBeDefined();
    expect(new RegExp(regex!.replace(/\\\\/g, "\\")).source).toBe(HEAVY_MODULE_PATTERN.source);
    // Type-only imports stay allowed for every heavy entry.
    expect(config).toMatch(/HEAVY_STATIC_PATHS\.map\(\(name\) => \(\{ name, message: HEAVY_MESSAGE, allowTypeImports: true \}\)\)/);
    expect(config).toMatch(/group:\s*HEAVY_SUBPATHS,\s*message:\s*HEAVY_MESSAGE,\s*allowTypeImports:\s*true/);
    expect(config).toMatch(/regex:\s*HEAVY_MODULES_REGEX,\s*message:\s*HEAVY_MESSAGE,\s*allowTypeImports:\s*true/);
    expect(config).toMatch(/group:\s*CSP_3D_BANNED/);
    expect(config).toMatch(/group:\s*GSAP_BANNED/);
    expect(config).toMatch(/group:\s*LUCIDE_BANNED,\s*message:\s*LUCIDE_MESSAGE/);
  });
});

/** Where ScrollTrigger's page-rewriting features are refused: the stage, and the HUD over it. */
const SCROLL_SCAN_ROOTS = ["components/scene", "components/hud", "lib/hud"];

describe("interior stage — ScrollTrigger stays harmless", () => {
  const sceneFiles = SCROLL_SCAN_ROOTS.flatMap((root) => listFiles(root, CODE));

  it("scans the stage's own files and the HUD chrome's", () => {
    expect(sceneFiles).toContain("components/scene/SceneStage.tsx");
    expect(sceneFiles).toContain("components/hud/HudChrome.tsx");
    expect(sceneFiles).toContain("lib/hud/gate.ts");
  });

  it("pins the feature detector on fixtures", () => {
    const hits = (src: string) =>
      FORBIDDEN_SCROLL_FEATURES.filter(([, pattern]) => pattern.test(withoutComments(src))).map(
        ([name]) => name,
      );
    expect(hits(`ScrollTrigger.create({ trigger, pin: true, snap: 0.5, markers: true })`)).toEqual([
      "pin",
      "snap",
      "markers",
    ]);
    expect(hits(`gsap.ticker.lagSmoothing(0); ScrollTrigger.normalizeScroll(true);`)).toEqual([
      "normalizeScroll",
      "lagSmoothing",
    ]);
    expect(hits(`const spinning = true; // never pin: here`)).toEqual([]);
    expect(hits(`{ scroller: el, pinSpacing: false }`)).toEqual(["pinSpacing", "scroller"]);
  });

  it("no file under components/scene, components/hud or lib/hud uses a forbidden feature", () => {
    const offenders = sceneFiles.flatMap((file) => {
      const src = withoutComments(read(file));
      return FORBIDDEN_SCROLL_FEATURES.filter(([, pattern]) => pattern.test(src)).map(
        ([name]) => `${file}: ${name}`,
      );
    });
    expect(offenders).toEqual([]);
  });
});

describe("interior stage — Tailwind and the directive-free art", () => {
  const sources = [...read("app/tailwind.css").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@source\s+["']([^"']+)["']\s*;/g)].map(
    (m) => posix.normalize(posix.join("app", m[1])),
  );
  const artFiles = listFiles("components/scene/art", /\.(?:ts|tsx|css)$/);

  it("the stage shell is scanned by Tailwind", () => {
    expect(sources).toContain("components/scene/SceneStage.tsx");
  });

  it("no art file is (its styles are a CSS Module)", () => {
    expect(artFiles.length).toBeGreaterThan(0);
    expect(sources.filter((path) => path.startsWith("components/scene/art"))).toEqual([]);
  });

  it("the art has no client directive", () => {
    const client = artFiles
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => /^\s*["']use client["']/m.test(withoutComments(read(file))));
    expect(client).toEqual([]);
  });
});

/** eslint.config.mjs `LUCIDE_BANNED`, entry for entry. */
const LUCIDE_BANNED = [
  "lucide-react/dynamic",
  "lucide-react/dynamic.js",
  "lucide-react/dynamic.mjs",
  "lucide-react/dynamicIconImports",
  "lucide-react/dynamicIconImports.mjs",
  "lucide-react/dist/*",
];

type LucideImport = { specifier: string; typeOnly: boolean; namespace: boolean; dynamic: boolean };

/** Every static import / re-export and every `import()` of lucide-react or a path inside it. */
function lucideImports(src: string): LucideImport[] {
  const code = withoutComments(src);
  const isLucide = (specifier: string) => specifier === "lucide-react" || specifier.startsWith("lucide-react/");
  const found: LucideImport[] = [];
  for (const m of code.matchAll(/(?:^|\n)\s*(import|export)\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/g)) {
    if (!isLucide(m[4])) continue;
    found.push({ specifier: m[4], typeOnly: Boolean(m[2]), namespace: /(^|,)\s*\*/.test(m[3].trim()), dynamic: false });
  }
  for (const m of code.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) {
    if (isLucide(m[1])) found.push({ specifier: m[1], typeOnly: false, namespace: false, dynamic: false });
  }
  for (const m of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    if (isLucide(m[1])) found.push({ specifier: m[1], typeOnly: false, namespace: true, dynamic: true });
  }
  return found;
}

/** What is wrong with a source's lucide imports, wherever it lives. */
const lucideProblems = (src: string): string[] =>
  lucideImports(src).flatMap(({ specifier, namespace, dynamic }) => [
    ...(specifier === "lucide-react" ? [] : [`${specifier}: not the package root`]),
    ...(dynamic ? [`import("${specifier}"): loads a namespace`] : namespace ? [`* from "${specifier}"`] : []),
  ]);

describe("icons — lucide-react stays named, static and in the HUD", () => {
  const sources = ["app", "components", "lib"]
    .flatMap((root) => listFiles(root, CODE))
    .filter((file) => !file.includes("/__tests__/"));

  it("pins the detector on fixtures", () => {
    expect(lucideProblems(`import { Activity, Blocks } from "lucide-react";`)).toEqual([]);
    expect(lucideProblems(`import {\n  SquareTerminal,\n  X,\n} from 'lucide-react';`)).toEqual([]);
    expect(lucideProblems(`import type { LucideProps } from "lucide-react";`)).toEqual([]);
    expect(lucideProblems(`// import * as Icons from "lucide-react";`)).toEqual([]);
    expect(lucideProblems(`import { Leaf } from "lucide-react-native";`)).toEqual([]);
    expect(lucideProblems(`import { DynamicIcon } from "lucide-react/dynamic";`)).toEqual([
      "lucide-react/dynamic: not the package root",
    ]);
    expect(lucideProblems(`import map from "lucide-react/dynamicIconImports.mjs";`)).toHaveLength(1);
    expect(lucideProblems(`import { __iconData } from "lucide-react/dist/esm/icons/activity.mjs";`)).toHaveLength(1);
    expect(lucideProblems(`import * as Icons from "lucide-react";`)).toEqual([`* from "lucide-react"`]);
    expect(lucideProblems(`import Icon, * as Icons from "lucide-react";`)).toHaveLength(1);
    expect(lucideProblems(`export * from "lucide-react";`)).toEqual([`* from "lucide-react"`]);
    expect(lucideProblems(`const icons = await import("lucide-react");`)).toEqual([
      `import("lucide-react"): loads a namespace`,
    ]);
    expect(lucideProblems(`const m = import('lucide-react/dynamic');`)).toHaveLength(2);
  });

  it("no source imports a dynamic entry point, a dist path or a namespace", () => {
    const offenders = sources.flatMap((file) => lucideProblems(read(file)).map((problem) => `${file}: ${problem}`));
    expect(offenders).toEqual([]);
  });

  it("only components/hud/** uses lucide-react at runtime", () => {
    const outside = sources.filter(
      (file) =>
        !file.startsWith("components/hud/") && lucideImports(read(file)).some(({ typeOnly }) => !typeOnly),
    );
    expect(outside).toEqual([]);
  });

  it("the ESLint config bans the same entry points, as import and import()", () => {
    const config = read("eslint.config.mjs");
    for (const specifier of LUCIDE_BANNED) expect(config, specifier).toContain(`"${specifier}"`);
    expect(config).toMatch(/ImportExpression\[source\.value=\/\^lucide-react/);
    expect(config).toMatch(/ImportDeclaration\[source\.value='lucide-react'\] > ImportNamespaceSpecifier/);
    expect(config).toMatch(/ExportAllDeclaration\[source\.value='lucide-react'\]/);
  });

  it("is pinned exactly", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["lucide-react"]).toBe("1.46.0");
  });
});
