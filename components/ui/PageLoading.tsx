import { BootCore } from "./BootCore";
import s from "./PageLoading.module.css";

/**
 * The full-window loading cover: what a visitor looks at until the stage has rendered.
 *
 * Rendered once by `SceneStage`, so every page that has a scene gets it and a page that does not
 * never pays for it. It is up only while `data-renderer` is `pending` — the server's own value,
 * so it is painted on the first frame and nobody watches the page assemble itself — and comes
 * down on ANY answer: `webgl`, `fallback` or `off`.
 *
 * **It blocks the page, so it carries a failsafe.** At 6s it comes down whatever the stage is
 * doing (`PageLoading.module.css`); the stage's own paths are all far shorter, so that only fires
 * on a genuine fault. Without it, a chunk that never arrived would leave a visitor on a blank
 * screen with no way past. The `<noscript>` rule in `app/(site)/layout.tsx` removes it outright,
 * because with no JavaScript no answer ever comes.
 *
 * What it shows is `BootCore` — the site's own processor in exploded view, turning, in real CSS
 * 3D. Not a spinner: the object a visitor is waiting for is a 3D scene, so the wait is that scene's
 * own vocabulary. It is not WebGL for the reason this whole cover exists: the scene's chunk and
 * shaders own the main thread right now.
 *
 * `aria-hidden`: the page underneath is server-rendered at full opacity and a screen reader can
 * read it the whole time, exactly as it can under the intro overlay. Nothing here takes focus,
 * so nobody is trapped behind it.
 *
 * **It costs LCP, and that is the trade.** An opaque cover over the hero means the largest
 * contentful paint is not counted until it lifts. The intro already accepts that on a first visit;
 * this accepts it on every load of a page with a stage, in exchange for never showing a
 * half-rendered page.
 */
export function PageLoading() {
  return (
    <div data-page-loading="" aria-hidden="true" className={s.cover}>
      <div className={s.grid} />
      <BootCore />
    </div>
  );
}
