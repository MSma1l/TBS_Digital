"use client";

import type { CSSProperties } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { solUI } from "@/lib/solutions";
import styles from "./Stakes.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/*
 * THE STAKES — step 2 of the copy framework's wireframe (docs/16, "Copy framework"): what it
 * costs the visitor NOT to act, said lightly. Three problems TBS's own offer answers — a site
 * that does not bring requests (sites, online stores), a whole product built before anyone tested
 * it (the MVP), hours of manual work (CRM, automations, bots) — and then the way out, which is the
 * site's one direct CTA. No figures, no urgency, no fear: each card names a cost the visitor can
 * recognise, not one we measured for them.
 *
 * `accent` tints the card's edge (a graphic, 3:1 is enough); `accentText` colours the 12px tag,
 * which is TEXT and owes 4.5:1 — the same split as Principles. No amber: it has no text twin and
 * is 3.77:1 on white (globals.css).
 */
type Stake = {
  id: string;
  tag: LocalizedText;
  title: LocalizedText;
  text: LocalizedText;
  accent: string;
  accentText: string;
};

const STAKES: Stake[] = [
  {
    id: "clients",
    tag: L("CLIENȚI", "КЛИЕНТЫ", "CUSTOMERS"),
    title: L("Clienți care ajung la alții", "Клиенты уходят к другим", "Customers who go elsewhere"),
    text: L(
      "Te caută online și nu te găsesc, sau site-ul nu spune clar ce oferi. Cererea ajunge la concurență.",
      "Вас ищут в интернете и не находят, или сайт не объясняет, что вы предлагаете. Заявка уходит к конкурентам.",
      "People look for you online and don't find you, or your site doesn't say clearly what you offer. The request goes to a competitor.",
    ),
    accent: "var(--red)",
    accentText: "var(--red-text)",
  },
  {
    id: "budget",
    tag: L("BUGET", "БЮДЖЕТ", "BUDGET"),
    title: L("Buget pus pe o idee netestată", "Бюджет на непроверенную идею", "Budget spent on an untested idea"),
    text: L(
      "Construiești tot produsul dintr-odată și afli abia la final dacă îl vrea cineva.",
      "Вы строите весь продукт сразу и только в конце узнаёте, нужен ли он кому-то.",
      "You build the whole product at once and only find out at the end whether anyone wants it.",
    ),
    accent: "var(--cyan)",
    accentText: "var(--cyan-text)",
  },
  {
    id: "time",
    tag: L("TIMP", "ВРЕМЯ", "TIME"),
    title: L("Ore pierdute pe muncă manuală", "Часы на ручную работу", "Hours lost to manual work"),
    text: L(
      "Tabele, date copiate dintr-un loc în altul, aceleași răspunsuri scrise iar și iar. Timp care nu mai rămâne pentru clienți.",
      "Таблицы, данные, перенесённые вручную, одни и те же ответы снова и снова. Время, которого не остаётся на клиентов.",
      "Spreadsheets, data copied from one place to another, the same answers typed again and again. Time you no longer have for customers.",
    ),
    accent: "var(--blue)",
    accentText: "var(--blue-text)",
  },
];

const SECTION = {
  title: L(
    "Ce pierzi când online-ul nu lucrează pentru tine.",
    "Что вы теряете, когда онлайн не работает на вас.",
    "What you lose when online doesn't work for you.",
  ),
  close: L(
    "Nu trebuie să rezolvi totul deodată. Începe cu o primă versiune mică, cu buget clar, și vezi ce funcționează.",
    "Не нужно решать всё сразу. Начните с небольшой первой версии с понятным бюджетом и посмотрите, что работает.",
    "You don't have to fix everything at once. Start with a small first version on a clear budget and see what works.",
  ),
};

/** Anchor of the section (`/#problema`). */
export const STAKES_ID = "problema";

export function Stakes() {
  const l = useLoc();
  const { openRequest } = useRequestFlow();

  return (
    <section id={STAKES_ID} className={styles.section}>
      <div className="container">
        <Reveal className={styles.head}>
          <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
        </Reveal>

        {/* `role="list"`: `list-style: none` costs a list its role in VoiceOver. */}
        <ul role="list" className={styles.grid}>
          {STAKES.map((stake, i) => (
            <li key={stake.id} className={styles.item}>
              <Reveal
                className={styles.card}
                style={
                  {
                    "--accent": stake.accent,
                    "--accent-text": stake.accentText,
                    "--card-index": i,
                  } as CSSProperties
                }
              >
                <div className={`mono ${styles.tag}`}>{l(stake.tag)}</div>
                <h3 className={`disp ${styles.cardTitle}`}>{l(stake.title)}</h3>
                <p className={styles.cardText}>{l(stake.text)}</p>
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal className={styles.close}>
          <p className={styles.closeText}>{l(SECTION.close)}</p>
          {/* `returnFocusTo`, as on every CTA on the page: Safari does not focus a button it
              clicks, so the dialog would have nowhere to hand focus back to. */}
          <button
            type="button"
            className={styles.cta}
            onClick={(event) => openRequest({ source: "home-stakes", returnFocusTo: event.currentTarget })}
          >
            {l(solUI.actionTalk)}
          </button>
        </Reveal>
      </div>
    </section>
  );
}
