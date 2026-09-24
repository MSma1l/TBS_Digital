import { Loading } from "@/components/ui/Loading";
import s from "./SceneLoading.module.css";

/**
 * The shared loading mark (`components/ui/Loading.tsx`), gated for a scene host.
 *
 * A host — the hero's right column on a service page, the Directions screen, Work's card track —
 * has nothing to show between first paint and the live model: the illustrations became the
 * FALLBACK rather than a preamble (`ServiceArt.module.css`), so without this the box would be
 * empty for as long as the capability probe, the three.js chunk, the shader compile and the first
 * frame take. On a phone that is seconds.
 *
 * Decorative on purpose — no `label`, so it is `aria-hidden`. Every host that uses it is already
 * `aria-hidden`, and a second announcement would be noise. Anything that waits on DATA should use
 * `<Loading label={t("common.loading")} />` directly instead, which is a live region.
 *
 * The host must be a positioned box: this fills it.
 */
export function SceneLoading() {
  return <Loading size="fill" className={s.host} />;
}
