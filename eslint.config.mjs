import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The 3D scenes are built procedurally on purpose. drei and three's asset loaders fetch HDRs,
// fonts, Draco/KTX2 decoders from CDNs or spin up blob: workers and wasm — all refused by the
// nonce-based CSP proxy.ts serves (no extra connect-src, no worker-src, no 'wasm-unsafe-eval').
// They would pass every local check and fail only in the browser, so they fail lint instead.
const CSP_3D_MESSAGE =
  "Fetches assets or needs workers/wasm, which the CSP in proxy.ts blocks (docs/11-security.md). Build the scene procedurally with three core.";
// gitignore-style patterns (a match also covers everything below it). `three/addons` and
// `three/examples/jsm` are two spellings of the same folder, so every entry comes twice (and
// files with and without their `.js`, spelled out: a glob like `WorkerPool*` over-matches).
//  · loaders — fetch assets, Draco/KTX2/Basis decoders (wasm, workers, CDN);
//  · libs — the decoders themselves (meshopt, draco, basis: WebAssembly.instantiate);
//  · physics — Rapier/Jolt/Ammo, fetched from a CDN and compiled from wasm at runtime;
//  · utils/WorkerPool(.js) — blob: workers;
//  · Addons(.js) — the barrel that re-exports all of the above;
//  · @dimforge/* (Rapier, which @types/three installs) and troika-three-text (blob workers).
const CSP_3D_BANNED = [
  "@react-three/drei",
  "@react-three/drei/*",
  "three/examples/jsm/loaders/*",
  "three/addons/loaders/*",
  "three/examples/jsm/libs/*",
  "three/addons/libs/*",
  "three/examples/jsm/physics/*",
  "three/addons/physics/*",
  "three/examples/jsm/utils/WorkerPool.js",
  "three/examples/jsm/utils/WorkerPool",
  "three/addons/utils/WorkerPool.js",
  "three/addons/utils/WorkerPool",
  "three/examples/jsm/Addons.js",
  "three/examples/jsm/Addons",
  "three/addons/Addons.js",
  "three/addons/Addons",
  "three-stdlib",
  "three-stdlib/*",
  "troika-three-text",
  "troika-three-text/*",
  "@dimforge/*",
];
// The bare `three/addons` barrel is an exact name, not a pattern: as a pattern it would also
// cover every harmless addon under it (controls, math…).
const CSP_3D_BANNED_PATHS = ["three/addons"];

// GSAP is imported as `gsap` and `gsap/ScrollTrigger` only.
//  · gsap/all — the barrel that bundles every plugin;
//  · gsap/dist/* — a second, UMD copy of the core with its own ticker (two tickers, two
//    ScrollTrigger registries);
//  · ScrollSmoother — rewrites body/html styles and hijacks scrolling;
//  · gsap-trial — the trial package, never shipped.
const GSAP_MESSAGE =
  "gsap/all bundles every plugin, gsap/dist is a second copy with its own ticker, ScrollSmoother rewrites body styles. Import `gsap` and `gsap/ScrollTrigger` only (docs/07-conventions.md).";
const GSAP_BANNED = [
  "gsap/all",
  "gsap/all.js",
  "gsap/dist/*",
  "gsap/ScrollSmoother",
  "gsap/ScrollSmoother.js",
  "gsap-trial",
  "gsap-trial/*",
];

// lucide-react is imported by name from the package root only, so each chunk carries the icons
// it names and nothing else (`sideEffects: false`).
//  · dynamic(.js/.mjs) — `DynamicIcon` looks icons up by string, through…
//  · dynamicIconImports(.mjs) — a map of an `import()` for every one of ~4,200 icons;
//  · dist/* — deep paths into the build; the package has no `exports` map, so they are not a
//    public API and move on any upgrade.
// `import * as` / `export *` / `import("lucide-react")` are refused in `no-restricted-syntax`:
// a namespace object keeps every icon.
const LUCIDE_MESSAGE =
  "Import lucide icons by name from \"lucide-react\" (docs/02-tech-stack.md): the dynamic entry points pull in every icon, and dist/* is not a public API.";
const LUCIDE_BANNED = [
  "lucide-react/dynamic",
  "lucide-react/dynamic.js",
  "lucide-react/dynamic.mjs",
  "lucide-react/dynamicIconImports",
  "lucide-react/dynamicIconImports.mjs",
  "lucide-react/dist/*",
];

// three.js + R3F and GSAP load lazily (next/dynamic / import()) behind the capability probe.
// A static import in a module the page bundle reaches ships ~290 KB to every visitor.
// Type-only imports are erased at build time, so they stay allowed everywhere.
//  · the packages by name, and every subpath of them (`gsap/ScrollTrigger.js`, `gsap/Observer`,
//    `three/webgpu`, `@react-three/fiber/native`…);
//  · the site's own modules that pull them in: the shared 3D runtime and the scene / director
//    components, whatever the relative or aliased spelling (`@/components/three/runtime`,
//    `../scene/SceneWorld`, `./IntroDirector.tsx`).
const HEAVY_MESSAGE =
  "Loads lazily behind the capability probe; a static import here ships ~290 KB to every visitor. Use next/dynamic or import() (docs/07-conventions.md).";
const HEAVY_STATIC_PATHS = ["three", "@react-three/fiber", "gsap", "gsap/ScrollTrigger", "@gsap/react"];
const HEAVY_SUBPATHS = ["three/*", "@react-three/fiber/*", "gsap/*", "@gsap/react/*"];
const HEAVY_MODULES_REGEX =
  "(^|/)(three/runtime|SceneCanvas|SceneWorld|SceneDirector|IntroScene|IntroDirector)(\\.(tsx?|jsx?|mjs))?$";

/** The shared option block. Flat config REPLACES a rule's options per matching block, so a
 *  file-scoped block that adds bans must repeat these. */
const restrictedImports = ({ heavy }) => [
  "error",
  {
    paths: [
      ...CSP_3D_BANNED_PATHS.map((name) => ({ name, message: CSP_3D_MESSAGE })),
      ...(heavy
        ? HEAVY_STATIC_PATHS.map((name) => ({ name, message: HEAVY_MESSAGE, allowTypeImports: true }))
        : []),
    ],
    patterns: [
      { group: CSP_3D_BANNED, message: CSP_3D_MESSAGE },
      { group: GSAP_BANNED, message: GSAP_MESSAGE },
      { group: LUCIDE_BANNED, message: LUCIDE_MESSAGE },
      ...(heavy
        ? [
            { group: HEAVY_SUBPATHS, message: HEAVY_MESSAGE, allowTypeImports: true },
            { regex: HEAVY_MODULES_REGEX, message: HEAVY_MESSAGE, allowTypeImports: true },
          ]
        : []),
    ],
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": restrictedImports({ heavy: false }),
      // `no-restricted-imports` does not see `import()`, and the scenes code-split with it.
      // The same lists as above as regexes; every slash is written as its escape, because a
      // literal one would end the esquery regex.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^(@react-three\\u002Fdrei|three-stdlib|troika-three-text)(\\u002F|$)|^@dimforge\\u002F|^three\\u002Faddons$|^three\\u002F(examples\\u002Fjsm|addons)\\u002F((loaders|libs|physics)\\u002F|Addons(\\.js)?$|utils\\u002FWorkerPool(\\.js)?$)/]",
          message: CSP_3D_MESSAGE,
        },
        {
          selector:
            "ImportExpression[source.value=/^gsap\\u002F(all(\\.js)?$|dist\\u002F|ScrollSmoother)|^gsap-trial/]",
          message: GSAP_MESSAGE,
        },
        {
          selector:
            "ImportExpression[source.value=/^lucide-react(\\u002F(dynamic(\\.m?js)?|dynamicIconImports(\\.mjs)?)$|\\u002Fdist\\u002F|$)/]",
          message: LUCIDE_MESSAGE,
        },
        {
          selector:
            "ImportDeclaration[source.value='lucide-react'] > ImportNamespaceSpecifier, ExportAllDeclaration[source.value='lucide-react']",
          message: LUCIDE_MESSAGE,
        },
      ],
    },
  },
  // Modules the page bundle reaches (and the interior stage's own shell, art and math, the
  // intro's up-front shell and both probe chunks, the HUD chrome's mount and its lazy parts):
  // no STATIC three / R3F / GSAP, nor a static import of a module that carries them.
  // `import()` stays allowed — that is how they load. The CSP, GSAP and lucide bans are
  // repeated inside (see `restrictedImports`).
  {
    files: [
      "app/**",
      "components/sections/**",
      "components/layout/**",
      "components/ui/**",
      "components/fx/**",
      "components/hud/**",
      "components/scene/SceneStage.tsx",
      "components/scene/art/**",
      "components/scene/shapes.ts",
      "components/three/RenderErrorBoundary.tsx",
      "components/three/capability.ts",
      "components/intro/IntroPreloader.tsx",
      "components/intro/IntroFallback.tsx",
      "components/intro/capability.ts",
      "components/intro/tiers.ts",
      "lib/**",
    ],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-imports": restrictedImports({ heavy: true }),
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored design-tool export — reference only, not our source (see README).
    "docs/reference/**",
  ]),
]);

export default eslintConfig;
