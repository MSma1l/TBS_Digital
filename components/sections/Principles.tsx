"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText, type MaybeLocalized } from "@/lib/i18n/content";
import { PROJECT_TYPES, SERVICE_FOR_TYPE, type EstimatorTypeId } from "@/lib/request/catalog";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { useSiteContent } from "@/lib/siteContent";
import { solUI } from "@/lib/solutions";
import styles from "./Principles.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

type MarkKind = "rezultat" | "pret" | "proces" | "echipa";

/* `accent` tints the hover edge, the mark and the card's proof (graphics — 3:1 is enough);
   `accentText` colours the 12px/800 number, which is TEXT and needs 4.5:1. They are separate
   because the brand fills (--blue 4.25:1, --green 3.21:1, --red 4.19:1 on white) all fail as small
   text. --amber has no -text twin: like --green, its value on the dark scale already carries
   small text (9.9:1 on --panel), so it fills both. */
type Why = {
  number: LocalizedText;
  title: LocalizedText;
  text: LocalizedText;
  mark: MarkKind;
  accent: string;
  accentText: string;
  /** Two of the bento's three columns from 1025px, and the whole width from 641px. */
  wide: boolean;
};

/* "De ce TBS" — four reasons since 2026-10-09, in the owner's words. The accents alternate cool
   and warm, so no layout puts like hues side by side: blue beside amber and green beside red in
   the bento's two rows, amber beside green between the two wide cards from 641px. */
const WHY: Why[] = [
  {
    number: L("01 / IPOTEZĂ", "01 / ГИПОТЕЗА", "01 / HYPOTHESIS"),
    title: L(
      "Începem cu ipoteza, nu cu lista de funcții",
      "Начинаем с гипотезы, а не со списка функций",
      "We start with the hypothesis, not a feature list",
    ),
    text: L(
      "Clarificăm ce vrei să afli de la utilizatori înainte să investești într-un produs mai mare.",
      "Уточняем, что вы хотите узнать от пользователей, прежде чем вкладываться в большой продукт.",
      "We clarify what you need to learn from users before investing in a larger product.",
    ),
    mark: "rezultat",
    accent: "var(--blue)",
    accentText: "var(--blue-text)",
    wide: true,
  },
  {
    number: L("02 / FOCUS", "02 / ФОКУС", "02 / FOCUS"),
    title: L(
      "Investiție inițială controlată",
      "Контролируемая начальная инвестиция",
      "A controlled initial investment",
    ),
    text: L(
      "Prima versiune are un scop clar, iar prețul de pornire îl vezi înainte să decizi.",
      "У первой версии есть ясная цель, а стартовую цену вы видите до решения.",
      "The first version has a clear purpose, and you see the starting price before deciding.",
    ),
    mark: "pret",
    accent: "var(--amber)",
    accentText: "var(--amber)",
    wide: false,
  },
  {
    number: L("03 / DOVEZI", "03 / ДОКАЗАТЕЛЬСТВА", "03 / EVIDENCE"),
    title: L(
      "Creștem după dovezi",
      "Растём на основе доказательств",
      "We grow on evidence",
    ),
    text: L(
      "Lansăm, urmărim feedbackul și alegem împreună următoarea etapă care merită construită.",
      "Запускаем, смотрим на обратную связь и вместе выбираем следующий этап, который стоит создавать.",
      "We launch, review feedback and choose together the next stage worth building.",
    ),
    mark: "proces",
    accent: "var(--green)",
    accentText: "var(--green-text)",
    wide: false,
  },
  {
    number: L("04 / CONTINUITATE", "04 / НЕПРЕРЫВНОСТЬ", "04 / CONTINUITY"),
    title: L("Aceeași echipă, de la MVP la produs", "Одна команда — от MVP до продукта", "One team, from MVP to product"),
    text: L(
      "Păstrăm contextul, codul și deciziile, astfel încât produsul să poată evolua fără reluări inutile.",
      "Мы сохраняем контекст, код и решения, чтобы продукт развивался без лишних повторов.",
      "We retain the context, code and decisions so the product can evolve without needless restarts.",
    ),
    mark: "echipa",
    accent: "var(--red)",
    accentText: "var(--red-text)",
    wide: true,
  },
];

const SECTION = {
  title: L("De ce TBS pentru prima versiune.", "Почему TBS для первой версии.", "Why TBS for the first version."),
};

/*
 * THE CARD MARKS.
 *
 * One small drawing per card, the SAME size in the SAME corner on all four. That sameness is
 * the whole point and it is what the first attempt got wrong: a 3D model in one card, a list in
 * the next and a large empty frame in the third gave the row three different visual weights, and
 * the empty frame read as a panel that had failed to load rather than as a deliberate mark.
 *
 * Drawn to the house rules for line art (docs/07): straight strokes, square caps, no circles, no
 * decorative dots, nothing animated on `stroke-dashoffset`. They carry no text and are hidden
 * from assistive technology — the sentence beside each one is the claim, and the mark is only
 * that claim drawn. `data-mark` names them, so they can be told apart from the proofs' own line
 * art (the track's ticks).
 */
const MARKS: Record<MarkKind, ReactNode> = {
  /* Framed and sighted: aimed at the outcome. The instrument, not a reading — there is no number
     in it and there never may be (see the note in the stylesheet). */
  rezultat: (
    <>
      <path d="M3.4 8.2V3.4h4.8M16.2 3.4H21v4.8M21 16.2V21h-4.8M8.2 21H3.4v-4.8" />
      <path d="M12 7.8v8.4M7.8 12h8.4" />
    </>
  ),
  /* A price tag with nothing written on it. The figure is the owner's, set in the admin and read
     from the store wherever a price is shown, so a number here would be invented, or right only
     until the first price changes. Its hole is a square, not the usual ring. */
  pret: (
    <>
      <path d="M3.4 3.4h8.4l8.8 8.8-8.4 8.4-8.8-8.8z" />
      <path d="M6.4 6.4h3.4v3.4H6.4z" />
    </>
  ),
  /* Three stages, listed: what a process you can follow looks like written down. Drawn as rows
     and not as three boxes on one horizontal run — that version was a thin strip, a third of the
     optical weight of the other marks, and the row stopped reading as a set. */
  proces: (
    <>
      <path d="M3 3.6h4.4V8H3zM3 9.8h4.4v4.4H3zM3 16h4.4v4.4H3z" />
      <path d="M10.4 5.8H21M10.4 12H21M10.4 18.2H21" />
    </>
  ),
  /* Layers: the site, the app, the CRM and the automations as one stack, because one team builds
     them to sit on each other. */
  echipa: (
    <>
      <path d="M12 3.5 21 8l-9 4.5L3 8z" />
      <path d="M3 12.2 12 16.7l9-4.5" />
      <path d="M3 16.2 12 20.7l9-4.5" />
    </>
  ),
};

function CardMark({ kind }: { kind: MarkKind }) {
  return (
    <svg
      data-mark={kind}
      className={styles.mark}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {MARKS[kind]}
    </svg>
  );
}

/*
 * THE PROOFS (2026-10-09).
 *
 * The owner put this section beside "Cum începem" and saw the same thing twice: a row of four
 * identical cards. So the four reasons stop being a row (the bento, Principles.module.css), and
 * each card now ends in the EVIDENCE for its sentence, read from where the site already keeps it:
 * the goals the request's assistant asks about, the admin's own starting prices, the stages a
 * project goes through, the team from the admin.
 *
 * This is not the first attempt's mistake come back. The number, the title, the text and the
 * mark keep the same places and sizes on all four, so the cards still read as one set; the proofs
 * differ because the evidence differs, and every one of them is the real thing rather than an
 * instrument standing in for a claim. Nothing in them is invented, and a proof with nothing real
 * to show (an empty team) is not drawn at all — an empty frame is what failed last time.
 *
 * `role="list"` on every list below: `list-style: none` costs a list its role in VoiceOver.
 */

/* ---------- 01 / IPOTEZĂ: the goals a client brings ----------
   Word for word the three quick replies the request's assistant opens with (`TREE.start` in
   components/sections/Estimator.tsx), written out again rather than imported: importing them
   would pull the whole estimator into the page, which RequestFlowProvider loads on demand on
   purpose. Change the two together. */
const GOALS: { id: string; label: LocalizedText }[] = [
  { id: "growth", label: L("Mai mulți clienți", "Больше клиентов", "More clients") },
  { id: "routine", label: L("Mai puțină rutină", "Меньше рутины", "Less routine") },
  { id: "product", label: L("Un produs nou", "Новый продукт", "A new product") },
];

/*
 * Three chips, not controls: nothing here is pressed, so nothing is a button and nothing reacts
 * to the pointer. As the card is revealed they light up one after another, as if the three
 * answers were being offered in turn, and stay lit — an entrance, never a loop (the stylesheet,
 * "the goals"). Under reduced motion, in forced colours, all three are simply lit.
 */
function GoalsProof() {
  const l = useLoc();

  return (
    <div className={styles.proof} data-proof="rezultat">
      <ul role="list" className={styles.goals}>
        {GOALS.map((goal, i) => (
          <li
            key={goal.id}
            className={styles.goal}
            style={
              {
                /* Its turn in the light, which the stylesheet's delay multiplies. */
                "--goal": i,
              } as CSSProperties
            }
          >
            <span className={styles.goalLit} aria-hidden="true" />
            <span className={styles.goalGlyph} aria-hidden="true">
              <span className={styles.goalGlyphFill} />
            </span>
            <span className={styles.goalLabel}>{l(goal.label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- 02 / PREȚ: the price list ----------
 * The request form's five project types, each with the price it starts at — the owner's figure
 * from the admin, never one written here. Read exactly as the request dialog's "PROPUNEREA TA"
 * reads it (Estimator.tsx): the service SERVICE_FOR_TYPE pairs with the type, its price in the
 * visitor's language, shown as written — the admin's text already says „de la 150€". So the list
 * can never quote a figure the dialog then contradicts.
 *
 * Where the dialog would fall back to its built-in figure (a service missing, empty or still on
 * the seed's "..." placeholder), this shows none at all: the type alone, still a way into the
 * request. `directionPrice` (lib/solutions.ts) makes the same call for a direction.
 */
function startingPrice(
  type: EstimatorTypeId,
  services: readonly { id: string; price: MaybeLocalized }[],
  l: (value: MaybeLocalized | undefined | null) => string,
): string {
  const text = l(services.find((s) => s.id === SERVICE_FOR_TYPE[type])?.price).trim();
  // "..." is PRICE_PLACEHOLDER (lib/content.ts), spelled out the way `directionPrice` spells it.
  return text.startsWith("...") ? "" : text;
}

function PriceProof() {
  const l = useLoc();
  const { services } = useSiteContent();
  const { openRequest } = useRequestFlow();
  /* What every row does, said once and read after each row's own name: the site's words for this
     request ("Cere ofertă", the services' button, which opens the same dialog). Hidden, because
     the ↗ on each row already says it to the eye. */
  const actionId = useId();

  return (
    <div className={styles.proof} data-proof="pret">
      <ul role="list" className={styles.prices} data-price-list="">
        {PROJECT_TYPES.map((type) => {
          const price = startingPrice(type.id, services, l);
          return (
            <li key={type.id}>
              {/* `returnFocusTo`, as on every CTA on the page: Safari does not focus a button it
                  clicks, so "whatever had focus" would be <body> and the dialog would have nowhere
                  to hand focus back to. */}
              <button
                type="button"
                className={styles.priceRow}
                aria-describedby={actionId}
                onClick={(event) =>
                  openRequest({
                    source: "home-why",
                    projectType: type.id,
                    returnFocusTo: event.currentTarget,
                  })
                }
              >
                <span className={styles.priceType}>{l(type.label)}</span>
                {/* The space is for a listener, who would otherwise hear "prezentarede la…";
                    between flex items it is never rendered. */}
                {price ? (
                  <>
                    {" "}
                    <span className={styles.leader} aria-hidden="true" />
                    <span className={styles.priceValue}>{price}</span>
                  </>
                ) : null}
                <span className={styles.priceGo} aria-hidden="true">
                  ↗
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <span id={actionId} hidden>
        {l(solUI.actionTalk)}
      </span>
    </div>
  );
}

/* ---------- 03 / PROCES: a project's track ----------
 * An illustration of what the client follows, not a report on any real project: four stages,
 * the first three done and the last to come, each closed by a demo — the "demo-uri regulate" of
 * the sentence above it. So it carries no number, no percentage, no date and no name: anything
 * it could put there would be invented.
 * Real text in a real list, not `aria-hidden`: a listener gets the stages the eye gets. Which ones
 * are done is drawn (the filled segment and its tick), not said — it is an illustration, and the
 * sentence above it is the claim.
 */
const STAGES: { id: string; label: LocalizedText; done: boolean }[] = [
  { id: "strategy", label: L("Strategie", "Стратегия", "Strategy"), done: true },
  { id: "design", label: L("Design", "Дизайн", "Design"), done: true },
  { id: "development", label: L("Dezvoltare", "Разработка", "Development"), done: true },
  { id: "launch", label: L("Lansare", "Запуск", "Launch"), done: false },
];

const DEMO = L("demo", "демо", "demo");

function TrackProof() {
  const l = useLoc();

  return (
    <div className={styles.proof} data-proof="proces">
      <ol role="list" className={styles.track}>
        {STAGES.map((stage, i) => (
          <li
            key={stage.id}
            className={styles.stage}
            data-done={stage.done ? "" : undefined}
            style={
              {
                /* Its place on the track, which the fill's entrance multiplies. */
                "--seg": i,
              } as CSSProperties
            }
          >
            <span className={styles.seg} aria-hidden="true">
              {stage.done ? (
                <>
                  <span className={styles.segFill} />
                  {/* Two runs at exactly 45°, butt ends and a mitred corner: the house line art. */}
                  <svg
                    className={styles.tick}
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M2 6.5 4.5 9 10 3.5" />
                  </svg>
                </>
              ) : null}
            </span>
            <span className={styles.stageName}>{l(stage.label)}</span>{" "}
            <span className={`mono ${styles.demo}`}>{l(DEMO)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- 04 / ECHIPĂ: who builds it ----------
 * The team from the admin, read the way the team section reads it (components/sections/Team.tsx):
 * the name as entered and the role in the visitor's language — names only, no faces (the owner
 * took the photographs and initials out, 2026-10-09: the team section right under this one shows
 * them). Four at most; nobody is invented to fill the list, and with no team the card simply has
 * no proof.
 */
const MAX_PEOPLE = 4;

function TeamProof() {
  const l = useLoc();
  const { team } = useSiteContent();
  const crew = team
    .map((m) => ({ id: m.id, name: typeof m.name === "string" ? m.name.trim() : "", role: l(m.role) }))
    /* A member with no name is a blank the owner has not filled in yet. */
    .filter((m) => m.name !== "")
    .slice(0, MAX_PEOPLE);

  if (crew.length === 0) return null;

  return (
    <div className={`${styles.proof} ${styles.crew}`} data-proof="echipa">
      <ul role="list" className={styles.people}>
        {crew.map((m) => (
          <li key={m.id} className={styles.person}>
            <span className={`disp ${styles.personName}`}>{m.name}</span>{" "}
            {m.role ? <span className={styles.personRole}>{m.role}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardProof({ kind }: { kind: MarkKind }) {
  switch (kind) {
    case "rezultat":
      return <GoalsProof />;
    case "pret":
      return <PriceProof />;
    case "proces":
      return <TrackProof />;
    case "echipa":
      return <TeamProof />;
  }
}

export function Principles() {
  const l = useLoc();

  return (
    <section id="despre" className={styles.section}>
      <div className="container">
        <Reveal className={styles.head}>
          <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
        </Reveal>

        <div className={styles.grid}>
          {WHY.map((w, i) => (
            <Reveal
              key={w.mark}
              className={w.wide ? `${styles.card} ${styles.wide}` : styles.card}
              style={
                {
                  "--accent": w.accent,
                  "--accent-text": w.accentText,
                  /* This card's place in the source, which the mark's entrance multiplies. */
                  "--card-index": i,
                } as CSSProperties
              }
            >
              <div className={styles.cardTop}>
                <div className={`mono ${styles.number}`}>{l(w.number)}</div>
                <CardMark kind={w.mark} />
              </div>
              <h3 className={`disp ${styles.cardTitle}`}>{l(w.title)}</h3>
              <p className={styles.cardText}>{l(w.text)}</p>
              <CardProof kind={w.mark} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
