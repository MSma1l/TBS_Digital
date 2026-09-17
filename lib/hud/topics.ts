/**
 * The page areas the Ghid TBS can offer help about, by the id a `data-guide-topic`
 * attribute carries:
 *
 *   - `servicii` — the home page's services selector (`#servicii`);
 *   - `lucrari`  — the home page's projects (`#lucrari`);
 *   - `service`  — a service page (`/servicii/<slug>`).
 *
 * The id also travels with the request (`RequestContext.guideTopic`) and is written into the
 * lead as `- Secțiune: <topic>`, so the estimator validates it with `isGuideTopic` first:
 * only these ids ever reach the team, whatever an attribute or a caller happens to carry.
 *
 * Pure data, no DOM: any chunk can import it.
 */
export const GUIDE_TOPICS = ["servicii", "lucrari", "service"] as const;
export type GuideTopic = (typeof GUIDE_TOPICS)[number];

/** A topic id from `GUIDE_TOPICS`. */
export const isGuideTopic = (v: unknown): v is GuideTopic =>
  typeof v === "string" && (GUIDE_TOPICS as readonly string[]).includes(v);
