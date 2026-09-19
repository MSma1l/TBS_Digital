/**
 * The projects laptop — a service page's "Proiecte relevante" shelf gets a machine standing in
 * it, and the project screenshots play on its display.
 *
 * It is a WIREFRAME INSTRUMENT, not a product shot: the same vocabulary as the five service
 * models and the three benefit panels. Every solid is one unit `BoxGeometry` sized by its own
 * matrix and drawn by `SURFACE_MODE.edges` — a lit 1px edge, a 0.035 face, a 0.05 fresnel rim,
 * composited additively on near-black. No light, no shadow, no bevel, no radius, and no texture
 * anywhere except the screen. Colour is per instance, the panel row's trick (`panel/kit.ts`):
 * `uColorA` goes white after every `paint()`, so a slot's `setColorAt(role x gain)` carries both
 * the hue and the brightness and the `edges` branch splits them back out. Zero extra uniforms, no
 * new material branch, no new shader.
 *
 * **Two draws.** The frame — deck, hinge, lip, trackpad, four lid rails, three key rows and two
 * feet — is thirteen instances of one `InstancedMesh`, so it costs ONE draw call however much of
 * the machine is built. The display is one `PlaneGeometry` on `SURFACE_MODE.holo`, the Work
 * hologram's own branch, so it costs one more. Nothing else is drawn.
 *
 * **The display is the Work hologram, unchanged.** `three/hologram.ts` composes a project card —
 * its screenshot as luminance under scanlines, its chips, its name, its index, bracket corners —
 * on a canvas capped at 384 x 240, in `HOLOGRAM.cell`-px cells, so a screenshot's fine print (the
 * Statistic card's e-mail address) is not legible on it. That cap and that reason are not
 * negotiable and nothing here touches them. It needs no sibling pipeline either: 384 x 240 is
 * 16:10, which is a laptop's own display aspect — `SCREEN` below is 2.28 x 1.425, the same 1.6 —
 * so the texture lands on the panel with no crop and no stretch at all.
 *
 * What it does:
 *  · **opens** — the lid swings up off the deck over `LAPTOP_OPEN_SECONDS` as the shelf arrives,
 *    and folds shut again when it leaves. The display is not drawn until the lid is past
 *    `SCREEN_FROM`: a hologram glowing through a closed lid would be a hole in the object;
 *  · **turns a little** — it cancels most of the world's shared sway (the panel row's
 *    `PANEL_SWAY_DAMPEN` idiom) and adds a slow yaw of its own about `LAPTOP_POSE.yaw`, so it has
 *    a side without ever turning the display away from the visitor;
 *  · **lives** — a caret runs the three key rows once a loop, the trackpad takes the loop's one
 *    accent, and the lid's rails answer every project swap with the hologram's glitch.
 */

import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Texture,
} from "three";
import type { SceneTierConfig } from "../../tiers";
import { SURFACE_MODE, createSurfaceMaterial, paint, toColor } from "../materials";
import type { ScenePalette } from "../palette";
import { MODEL_SWAY, place, type ModelFrame, type PanelModel } from "./types";
import {
  PANEL_GAIN,
  PANEL_INTENSITY,
  PANEL_SWAY_DAMPEN,
  easeInOut,
  flare,
  lerp,
  pulse,
} from "./panel/kit";

/* ---- the machine, in model units ------------------------------------------------------------ */

/**
 * The deck: 2.4 across, 1.62 deep, thin, centred on the body's origin. Every other part is placed
 * off it, so the whole object has one set of measurements rather than eleven.
 */
const DECK = { w: 2.4, d: 1.62, t: 0.07 } as const;

/**
 * The hinge axis — the one line the lid turns about — just inside the deck's back edge and a
 * little above its top face, where a real barrel sits.
 */
const HINGE = { y: DECK.t / 2 + 0.02, z: -DECK.d / 2 + 0.02, w: 1.05, r: 0.1 } as const;

/**
 * The lid and the display inside it. `SCREEN` is 1.6 : 1 — the hologram canvas's own aspect — and
 * the bezel is what is left over: 0.06 at the sides, 0.0375 at the head and the foot. At the ~120
 * px per model unit this object is drawn at inside a card-sized cell those are a 7px and a 4.5px
 * rail, which is the benefit row's hairline weight (`panel/kit.ts` STROKE, 4.6px) expressed at
 * this object's scale rather than borrowed from that one's.
 */
const LID = { w: 2.4, h: 1.5, t: 0.05 } as const;
const SCREEN = { w: 2.28, h: 1.425 } as const;
const BEZEL = { x: (LID.w - SCREEN.w) / 2, y: (LID.h - SCREEN.h) / 2 } as const;
/** The display's centre up the lid (lid-local: the hinge is the origin, +y runs up the lid). */
const SCREEN_Y = BEZEL.y + SCREEN.h / 2;

/** The deck's furniture: the opening lip at the front edge, the trackpad, three key rows, two feet. */
const LIP = { w: 1.1, t: 0.04, d: 0.045, z: DECK.d / 2 - 0.02 } as const;
const PAD = { w: 0.8, t: 0.016, d: 0.5, z: 0.38 } as const;
const KEYS = { w: 1.9, t: 0.022, d: 0.11, rows: [-0.55, -0.33, -0.11] } as const;
const FOOT = { w: 0.32, t: 0.04, d: 0.2, x: 0.84, z: -0.48 } as const;

/**
 * The lid's angle from the deck plane, radians: all but shut, and open. 1.87 rad is 107 degrees —
 * a real machine's working angle, and the one that puts the display square to the camera once the
 * body is pitched `LAPTOP_POSE.pitch` towards it (the pitch tips the display's normal that far
 * down; the lean takes it back up). Never 90 exactly: a lid at dead vertical reads as a flat panel
 * standing on a slab, not as a laptop.
 */
export const LID_ANGLE = { shut: 0.045, open: 1.87 } as const;

/**
 * The pose the object is drawn at: pitched towards the viewer so the deck is seen from above, and
 * turned `yaw` off square so it has a side. `choreography.ts` `LAPTOP_LIT` is this model's bound
 * turned by exactly this, and that is what the window is fitted against.
 */
export const LAPTOP_POSE = { pitch: 0.3, yaw: -0.16, swing: 0.09, period: 7.9 } as const;

/**
 * The object's reach in its own frame — the lid at its open angle, the feet under the deck, the
 * lip at the front — and the offset that puts its centre on the pose group's origin, so the pitch
 * and the yaw turn it about its middle instead of about the deck's back edge. Derived, never
 * typed in: change the lid's angle and the object re-centres itself.
 */
const REACH = {
  top: HINGE.y + LID.h * Math.sin(LID_ANGLE.open),
  bottom: -DECK.t / 2 - FOOT.t,
  back: HINGE.z + LID.h * Math.cos(LID_ANGLE.open),
  front: LIP.z + LIP.d / 2,
} as const;

/**
 * …and the one number in that offset that is measured rather than derived. What the window has to
 * hold is not the BOXES, it is the light — and the pose pitches the deck towards the viewer, so
 * the deck's glow reaches further below the object's geometric centre than the lid's does above
 * it. Centred on its boxes, the machine sat low in its window: 69px of clear air over it and 17px
 * under it at 1280 (diffed against the same page with the canvas hidden). This lifts it by that
 * difference, so the LIT box is what is centred and both margins are the same — which is worth
 * about 5% of size, because the fit then has no wasted air to reserve at the top.
 */
const LIFT = 0.15;
const BODY = { y: -(REACH.top + REACH.bottom) / 2 + LIFT, z: -(REACH.back + REACH.front) / 2 } as const;

/**
 * The object's own half-extents, before the pose turns them. Exported for the same reason
 * `PANEL_BOUND` is: it says what the thing IS, while `choreography.ts` `LAPTOP_LIT` says what it
 * LIGHTS — and for anything drawn additively those are not the same number.
 */
export const LAPTOP_BOUND = {
  halfWidth: LID.w / 2,
  halfHeight: (REACH.top - REACH.bottom) / 2,
  halfDepth: (REACH.front - REACH.back) / 2,
} as const;

/* ---- the clock ------------------------------------------------------------------------------- */

/** The loop, seconds. Shares no period with the benefits row (3.6 / 4.2 / 4.8) or with the helix. */
export const LAPTOP_LOOP = 5.4;

/** The caret's run across the three key rows: when it reaches each row, and how long it dwells. */
export const LAPTOP_TYPE = { from: 0.45, step: 0.55, dwell: 0.5 } as const;

/** The loop's one accent: the trackpad, once — and nothing else in the object ever crosses `lit`. */
export const LAPTOP_ACCENT = 2.62;

/** Seconds the lid takes to swing open (or shut), and the reveal at which it starts to. */
export const LAPTOP_OPEN_SECONDS = 1.1;
const OPEN_AT = 0.35;

/** The lid has to be at least this far open before the display is drawn at all. */
const SCREEN_FROM = 0.45;

/** Seconds a swap's glitch takes to decay from 1 to 0 — the helix's own (`HELIX_GLITCH_SECONDS`). */
export const LAPTOP_GLITCH_SECONDS = 0.35;

/** The display draws a little lighter in ink, exactly as the Work hologram does. */
const SCREEN_INTENSITY = { glow: 1, ink: 0.85 } as const;

/* ---- pure arithmetic (the unit tests pin these) ---------------------------------------------- */

/** Pure. The lid's angle from the deck at `open` (0 shut → 1 open), radians. */
export function laptopLidAngle(open: number): number {
  return lerp(LID_ANGLE.shut, LID_ANGLE.open, easeInOut(open));
}

/**
 * Pure. How lit key row `row` is at `t` seconds into the loop, 0 → 1: a caret passing over it once,
 * with an eased edge, so nothing in the object ever switches on.
 */
export function laptopKeyAt(t: number, row: number): number {
  const from = LAPTOP_TYPE.from + row * LAPTOP_TYPE.step;
  return pulse(t, from, from + LAPTOP_TYPE.dwell, 0.12);
}

/** Pure. The loop's one accent: a bell on the trackpad at `LAPTOP_ACCENT`. */
export function laptopAccentAt(t: number): number {
  return flare(t, LAPTOP_ACCENT, 0.12);
}

/** Pure. How hard the hinge is working at `open` — a bell, so it is dark at both ends of the swing. */
export function laptopHingeAt(open: number): number {
  const x = open < 0 ? 0 : open > 1 ? 1 : open;
  return 4 * x * (1 - x);
}

/* ---- the object ------------------------------------------------------------------------------ */

/**
 * The frame's slots. The order IS the drop order — `mesh.count` draws 0..n−1, so everything a
 * smaller tier or the governor's lite step gives up lives at the end. The machine is always the
 * deck, the hinge, the lip, the trackpad and the four rails; the key rows and the feet are detail.
 */
const SLOT = { deck: 0, hinge: 1, lip: 2, pad: 3, rails: 4, keys: 8, feet: 11 } as const;
const SLOT_COUNT = 13;
/** Without the feet (mid), and without the key rows either (lite). */
const SLOT_MID = SLOT.feet;
const SLOT_LITE = SLOT.keys;

const AXIS_X = new Vector3(1, 0, 0);
const UNIT = new Vector3(1, 1, 1);

export type LaptopModel = PanelModel & {
  /**
   * The hologram's texture, or null. The display is not drawn before there is one — a hairline
   * plane is still a draw, and an empty screen is not a picture that failed to load, it is a
   * machine that is off.
   */
  setHologram(texture: Texture | null): void;
  /** A project has been swapped onto the display: the house's glitch, and the rails answer it. */
  glitch(): void;
};

export function createLaptopModel(config: SceneTierConfig, palette: ScenePalette): LaptopModel {
  const group = new Group();
  group.name = "scene-laptop";
  const pose = new Group();
  pose.rotation.set(LAPTOP_POSE.pitch, LAPTOP_POSE.yaw, 0);
  group.add(pose);
  const body = new Group();
  body.position.set(0, BODY.y, BODY.z);
  pose.add(body);

  /* the frame: one geometry, one material, one draw */
  const geometry = new BoxGeometry(1, 1, 1);
  const shell = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
    intensity: PANEL_INTENSITY[palette.mode],
  });
  const shellMesh = place(new InstancedMesh(geometry, shell.material, SLOT_COUNT), 6);
  shellMesh.name = "scene-laptop-frame";
  body.add(shellMesh);

  /* the lid, and the display inside it: the one texture in the whole object */
  const lid = new Group();
  lid.position.set(0, HINGE.y, HINGE.z);
  body.add(lid);
  const screenGeometry = new PlaneGeometry(SCREEN.w, SCREEN.h);
  const screen = createSurfaceMaterial({ mode: SURFACE_MODE.holo, roles: { a: "cyan", b: "blue", hot: "hot" } });
  const screenMesh = place(new Mesh(screenGeometry, screen.material), 7);
  screenMesh.name = "scene-laptop-screen";
  // A hair proud of the rails, so the display sits IN the lid rather than through it.
  screenMesh.position.set(0, SCREEN_Y, 0.006);
  screenMesh.visible = false;
  lid.add(screenMesh);

  const cyan = new Color();
  const blue = new Color();
  const tint = new Color();
  const matrix = new Matrix4();
  const lidMatrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3(1, 1, 1);
  const turn = new Quaternion();

  let gain = PANEL_GAIN[palette.mode];
  const full = config.uiCards > 2 ? SLOT_COUNT : SLOT_MID;
  let shown = full;
  let lite = false;
  let clock = 0;
  /** 0 shut → 1 open, and the swap glitch, 1 → 0. */
  let open = 0;
  let glitchLeft = 0;
  shellMesh.count = shown;

  /**
   * One slot, from `position` / `scale` / `turn` (and `through` when it is a lid part). The hue and
   * the gain travel down one channel, the panel row's way: the shader reads `lum = max channel` as
   * the gain and `vTint / lum` as the hue, so the role's own brightness has to be divided out
   * first — a dark role would otherwise arrive at a fraction of the gain it asked for and the gain
   * table would mean nothing.
   */
  const write = (slot: number, colour: Color, value: number, through?: Matrix4) => {
    matrix.compose(position, turn, scale);
    if (through) matrix.premultiply(through);
    shellMesh.setMatrixAt(slot, matrix);
    const top = Math.max(colour.r, colour.g, colour.b);
    const g = value < 0 ? 0 : value;
    tint.copy(colour).multiplyScalar(top > 1e-4 ? g / top : 0);
    shellMesh.setColorAt(slot, tint);
  };

  /** A lid rail, in lid-local coordinates, through the lid's own matrix. */
  const writeRail = (slot: number, x: number, y: number, w: number, h: number, value: number) => {
    position.set(x, y, -LID.t / 2);
    scale.set(w, h, LID.t);
    turn.identity();
    write(slot, cyan, value, lidMatrix);
  };

  /** Scale 0 — the house's way of not drawing something that has a slot. */
  const hide = (slot: number) => {
    position.set(0, 0, 0);
    scale.set(0, 0, 0);
    turn.identity();
    matrix.compose(position, turn, scale);
    shellMesh.setMatrixAt(slot, matrix);
  };

  const compose = () => {
    const t = clock;
    const accent = laptopAccentAt(t);
    // The lid's angle, and the breath on top of it: a machine at rest is not a still image.
    const angle = laptopLidAngle(open) + Math.sin((t / LAPTOP_LOOP) * Math.PI * 2) * 0.014 * open;
    // A lid-local point sits at hinge + R(π/2 − angle about x) · p: at π/2 the lid stands in the
    // body's own xy plane, at 1.87 it leans back over the hinge, at 0 it lies flat on the deck.
    turn.setFromAxisAngle(AXIS_X, Math.PI / 2 - angle);
    lid.quaternion.copy(turn);
    lidMatrix.compose(lid.position, turn, UNIT);

    /* the deck */
    position.set(0, 0, 0);
    scale.set(DECK.w, DECK.t, DECK.d);
    turn.identity();
    write(SLOT.deck, blue, gain.rest);

    /* the hinge barrel: the one part of the machine that is doing something while the lid swings */
    position.set(0, HINGE.y, HINGE.z);
    scale.set(HINGE.w, HINGE.r, HINGE.r);
    turn.identity();
    write(SLOT.hinge, blue, lerp(gain.rest, gain.body, laptopHingeAt(open)));

    /* the opening lip at the front edge */
    position.set(0, 0, LIP.z);
    scale.set(LIP.w, LIP.t, LIP.d);
    turn.identity();
    write(SLOT.lip, blue, gain.rest);

    /* the trackpad — the loop's one accent, and the only thing in the object that passes `lit` */
    position.set(0, DECK.t / 2 + PAD.t / 2, PAD.z);
    scale.set(PAD.w, PAD.t, PAD.d);
    turn.identity();
    write(SLOT.pad, cyan, lerp(gain.body, gain.accent, accent));

    /* the lid's four rails: the display's own frame, answering every swap */
    const railGain = lerp(gain.body, gain.lit, glitchLeft);
    writeRail(SLOT.rails, 0, BEZEL.y / 2, LID.w, BEZEL.y, railGain);
    writeRail(SLOT.rails + 1, 0, LID.h - BEZEL.y / 2, LID.w, BEZEL.y, railGain);
    writeRail(SLOT.rails + 2, -(LID.w - BEZEL.x) / 2, LID.h / 2, BEZEL.x, LID.h, railGain);
    writeRail(SLOT.rails + 3, (LID.w - BEZEL.x) / 2, LID.h / 2, BEZEL.x, LID.h, railGain);

    /* the key rows: a caret runs them once a loop, and they are dark the rest of it */
    for (let row = 0; row < KEYS.rows.length; row += 1) {
      const slot = SLOT.keys + row;
      if (shown <= slot) {
        hide(slot);
        continue;
      }
      position.set(0, DECK.t / 2 + KEYS.t / 2, KEYS.rows[row]);
      scale.set(KEYS.w, KEYS.t, KEYS.d);
      turn.identity();
      write(slot, cyan, lerp(gain.rest, gain.lit, laptopKeyAt(t, row) * open));
    }

    /* the two feet under the back of the deck */
    for (let i = 0; i < 2; i += 1) {
      const slot = SLOT.feet + i;
      if (shown <= slot) {
        hide(slot);
        continue;
      }
      position.set(i === 0 ? -FOOT.x : FOOT.x, -DECK.t / 2 - FOOT.t / 2, FOOT.z);
      scale.set(FOOT.w, FOOT.t, FOOT.d);
      turn.identity();
      write(slot, blue, gain.rest);
    }

    shellMesh.instanceMatrix.needsUpdate = true;
    if (shellMesh.instanceColor) shellMesh.instanceColor.needsUpdate = true;
  };

  const applyPalette = (next: ScenePalette) => {
    paint(shell, next);
    // White, so a slot's instance colour IS its hue x gain rather than a tint over one.
    shell.uniforms.uColorA.value.setRGB(1, 1, 1);
    shell.uniforms.uIntensity.value = PANEL_INTENSITY[next.mode];
    paint(screen, next);
    screen.uniforms.uIntensity.value = SCREEN_INTENSITY[next.mode];
    toColor(next.cyan, cyan);
    toColor(next.blue, blue);
    gain = PANEL_GAIN[next.mode];
    compose();
  };

  applyPalette(palette);

  /** The display exists only once it has something to show and the lid is far enough open. */
  const showScreen = (prewarm: boolean) => {
    screenMesh.visible = (screen.uniforms.uMap.value !== null && open > SCREEN_FROM) || prewarm;
  };

  return {
    group,
    objects: [group],

    update(frame: ModelFrame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      const step = frame.step;
      clock += step;
      while (clock >= LAPTOP_LOOP) clock -= LAPTOP_LOOP;
      // The lid follows the shelf: open while the window is on screen, shut once it is not.
      const target = frame.reveal > OPEN_AT ? 1 : 0;
      const travel = step / LAPTOP_OPEN_SECONDS;
      open = target > open ? Math.min(target, open + travel) : Math.max(target, open - travel);
      glitchLeft = glitchLeft > 0 ? Math.max(0, glitchLeft - step / LAPTOP_GLITCH_SECONDS) : 0;
      compose();

      shell.uniforms.uTime.value = frame.time;
      shell.uniforms.uReveal.value = frame.reveal;
      screen.uniforms.uTime.value = frame.time;
      screen.uniforms.uReveal.value = frame.reveal;
      // Lite keeps the swap as an event (the rails' flare is a uniform, not a draw) and drops the
      // shear, which is the one thing about it that costs fill rate.
      screen.uniforms.uGlitch.value = lite ? 0 : glitchLeft;
      showScreen(frame.prewarm);

      // `frame.tx` / `frame.ty` are not read: the cards around this object already lean under the
      // pointer in CSS, and a machine that leaned with them would read as the shelf wobbling. It
      // cancels most of the world's shared sway — 24 degrees is far too much for a display that
      // has to stay readable — and turns on its own instead, only once it is open.
      const t = frame.time;
      const own = Math.sin((t / LAPTOP_POSE.period) * Math.PI * 2) * LAPTOP_POSE.swing;
      const sway = Math.sin(t * MODEL_SWAY.speed) * MODEL_SWAY.amplitude * PANEL_SWAY_DAMPEN;
      pose.rotation.set(LAPTOP_POSE.pitch, LAPTOP_POSE.yaw - sway + own * open, 0);
    },

    setHologram(texture) {
      screen.uniforms.uMap.value = texture;
      showScreen(false);
    },

    glitch() {
      glitchLeft = 1;
    },

    setLite(next) {
      lite = next;
      shown = next ? Math.min(SLOT_LITE, full) : full;
      shellMesh.count = shown;
      if (next) glitchLeft = 0;
      compose();
    },

    setPalette: applyPalette,

    dispose() {
      geometry.dispose();
      screenGeometry.dispose();
      shell.material.dispose();
      screen.material.dispose();
      shellMesh.dispose();
      screen.uniforms.uMap.value = null;
    },
  };
}
