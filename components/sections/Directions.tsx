"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { directionHref } from "@/lib/directions";
import { projectsForSolution, solutionPalette, solutions } from "@/lib/solutions";
import { useSiteContent } from "@/lib/siteContent";
import styles from "./Directions.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/**
 * The /02 block is a DIRECTION CHOOSER, not a second sales pitch.
 *
 * Every pill is a real link to `/servicii/<slug>` (the tabs used to be inert buttons, so a
 * visitor who clicked one and expected a page got nothing), and the preview under them is
 * read-only: one textual link into the service page and no competing CTA. Everything
 * commercial — talking to the team, the projects, the reference link — now lives in the
 * action bar on the service page itself (`DirectionPage`).
 *
 * `slug` is the CURRENT slug, so it keys straight into `lib/solutions.ts` (palette and
 * project membership) as well as into `directionHref`.
 */
type Service = {
  slug: string;
  tab: LocalizedText;
  tag: LocalizedText;
  title: LocalizedText;
  text: LocalizedText;
  list: LocalizedText[];
};

const SERVICES: Service[] = [
  {
    slug: "produs-digital",
    tab: L("Produs digital", "Цифровой продукт", "Digital product"),
    tag: L("DE LA IPOTEZĂ LA LANSARE", "ОТ ГИПОТЕЗЫ ДО ЗАПУСКА", "FROM HYPOTHESIS TO LAUNCH"),
    title: L("Produs digital", "Цифровой продукт", "Digital product"),
    text: L(
      "Clarificăm problema, proiectăm experiența și livrăm un produs ușor de evoluat.",
      "Проясняем задачу, проектируем опыт и выпускаем продукт, который легко развивать.",
      "We frame the problem, design the experience and ship a product that is easy to evolve.",
    ),
    list: [
      L("Workshop de strategie", "Стратегический воркшоп", "Strategy workshop"),
      L("UX/UI cu prototip testabil", "UX/UI с тестируемым прототипом", "UX/UI with a testable prototype"),
      L("Dezvoltare și măsurare", "Разработка и метрики", "Development and measurement"),
    ],
  },
  {
    slug: "e-commerce",
    /* The pill keeps the short label — it is a navigation item; the panel carries the full
       title. Nothing here is written in the past tense: we have not shipped a shop. */
    tab: L("E-commerce", "E-commerce", "E-commerce"),
    tag: L(
      "PRODUSE DIGITALE CARE SE VÂND CLAR",
      "ЦИФРОВЫЕ ПРОДУКТЫ, КОТОРЫЕ ПРОДАЮТСЯ ПОНЯТНО",
      "DIGITAL PRODUCTS THAT SELL CLEARLY",
    ),
    title: L(
      "E-commerce pentru produse, rapoarte și acces digital",
      "E-commerce для продуктов, отчётов и цифрового доступа",
      "E-commerce for products, reports and digital access",
    ),
    text: L(
      "Construim fluxul întreg: oferta, plata și accesul la produs sau la raport.",
      "Строим весь поток: предложение, оплата и доступ к продукту или отчёту.",
      "We build the whole flow: the offer, the payment and the access to the product or report.",
    ),
    list: [
      L("Checkout și plăți", "Чекаут и оплата", "Checkout and payments"),
      L("Livrare și acces digital", "Цифровая выдача и доступ", "Digital delivery and access"),
      L("Raportare și gestionare produse", "Отчётность и управление товарами", "Reporting and product management"),
    ],
  },
  {
    slug: "automatizare-api",
    tab: L("Automatizare & API", "Автоматизация и API", "Automation & API"),
    tag: L("CONECTEAZĂ CE CONTEAZĂ", "СОЕДИНЯЕМ ВАЖНОЕ", "CONNECT WHAT MATTERS"),
    title: L("Automatizare & API", "Автоматизация и API", "Automation & API"),
    text: L(
      "Eliminăm munca repetitivă și conectăm sistemele care trebuie să comunice.",
      "Убираем рутину и соединяем системы, которым нужно общаться друг с другом.",
      "We remove repetitive work and connect the systems that need to talk to each other.",
    ),
    list: [
      L("Audit de procese", "Аудит процессов", "Process audit"),
      L("Integrări sigure", "Безопасные интеграции", "Secure integrations"),
      L("Fluxuri și dashboard-uri", "Потоки и дашборды", "Flows and dashboards"),
    ],
  },
  {
    slug: "asistenti-ia",
    /* The pill label and the route stay as the client signed them off; only the panel copy
       changed, so that what is described as delivered is what actually runs. */
    tab: L("Asistenți IA & boturi", "ИИ-ассистенты и боты", "AI assistants & bots"),
    tag: L("IA CARE LUCREAZĂ CU ECHIPA", "ИИ, КОТОРЫЙ РАБОТАЕТ С КОМАНДОЙ", "AI THAT WORKS WITH YOUR TEAM"),
    title: L(
      "Asistenți și boți conectați la conversații reale",
      "Ассистенты и боты, подключённые к реальным разговорам",
      "Assistants and bots connected to real conversations",
    ),
    text: L(
      "Răspuns, calificare și automatizare prin web, Telegram și sistemele interne.",
      "Ответ, квалификация и автоматизация через веб, Telegram и внутренние системы.",
      "Answering, qualification and automation across web, Telegram and internal systems.",
    ),
    list: [
      L("Chat pentru clienți", "Чат для клиентов", "Chat for customers"),
      L("Asistent care califică cererea", "Ассистент, который квалифицирует заявку", "An assistant that qualifies the request"),
      L("Bot Telegram conectat la fluxul echipei", "Telegram-бот, подключённый к потоку команды", "A Telegram bot wired into the team's flow"),
    ],
  },
  {
    slug: "brand-ui",
    tab: L("Brand & UI", "Бренд и UI", "Brand & UI"),
    tag: L("O IDENTITATE CARE SE ȚINE MINTE", "ЗАПОМИНАЮЩАЯСЯ ИДЕНТИЧНОСТЬ", "AN IDENTITY THAT STICKS"),
    title: L("Brand & UI", "Бренд и UI", "Brand & UI"),
    text: L(
      "Dăm produsului un sistem vizual coerent, clar și ușor de folosit.",
      "Даём продукту цельную, ясную и удобную визуальную систему.",
      "We give the product a coherent, clear and easy-to-use visual system.",
    ),
    list: [
      L("Poziționare și direcție", "Позиционирование и направление", "Positioning and direction"),
      L("Design system", "Дизайн-система", "Design system"),
      L("Interfață premium", "Премиальный интерфейс", "Premium interface"),
    ],
  },
];

const SECTION = {
  eyebrow: L("Alege direcția potrivită", "Выберите направление", "Choose your direction"),
  title: L(
    "Un selector de servicii făcut pentru decizie rapidă.",
    "Селектор услуг, сделанный для быстрого решения.",
    "A service selector built for a fast decision.",
  ),
  lead: L(
    "Selectează o direcție. Conținutul se schimbă instant, iar pagina serviciului e la un click.",
    "Выберите направление. Контент меняется мгновенно, а страница услуги — в одном клике.",
    "Pick a direction. The content changes instantly and the service page is one click away.",
  ),
  tabsAria: L("Direcțiile de servicii", "Направления услуг", "Service directions"),
  more: L("Deschide serviciul", "Открыть услугу", "Open the service"),
};

const CASE = {
  /** Label above the real reference project of the selected direction. */
  ref: L("PROIECT REAL DIN PORTOFOLIU", "РЕАЛЬНЫЙ ПРОЕКТ ИЗ ПОРТФОЛИО", "REAL PROJECT FROM THE PORTFOLIO"),
  /** Last-resort label: a direction with neither a project nor a flow to show. Kept because
   *  the portfolio is editable — an admin can remove the projects a direction points at. */
  none: L("PORTOFOLIU", "ПОРТФОЛИО", "PORTFOLIO"),
  noneText: L(
    "Pe această direcție nu avem încă un proiect public în portofoliu.",
    "По этому направлению у нас пока нет публичного проекта в портфолио.",
    "We don't have a public project on this direction yet.",
  ),
};

/** "CRM PRIVAT · FĂRĂ LINK" → ["CRM PRIVAT", "FĂRĂ LINK"]. The tag is free localized text,
 *  so its segments are the only tag-like data a project actually has. */
function tagChips(tag: string): string[] {
  return tag
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function Directions() {
  const l = useLoc();
  const { projects } = useSiteContent();
  const [active, setActive] = useState(0);
  const svc = SERVICES[active];

  /* The preview card shows the direction's own reference project (the first entry of its
     list in lib/solutions.ts), resolved against the live portfolio — not a hard-coded
     project repeated under all five tabs. */
  const reference = projectsForSolution(svc.slug, projects)[0];
  const refNumber = reference
    ? String(projects.findIndex((p) => p.id === reference.id) + 1).padStart(2, "0")
    : "";
  const palette = solutionPalette[svc.slug];
  /* A direction we sell as a capability (e-commerce) has no project to show, and must not
     borrow one: its card draws the flow we build — offer → payment → access — from the same
     table the service page reads. No project name, no external link. */
  const sol = solutions[svc.slug];
  const flow = !reference && sol?.flow?.length ? sol : undefined;

  return (
    <section id="servicii" className={styles.section}>
      <div className="container">
        <Reveal className={styles.top}>
          <div>
            <div className={`mono ${styles.eyebrow}`}>{l(SECTION.eyebrow)}</div>
            <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
          </div>
          <p className={styles.lead}>{l(SECTION.lead)}</p>
        </Reveal>

        {/* Links, not tabs: each one navigates to its service page. Pointer/focus/click all
            move the preview, so the selection is still visible before leaving the page. */}
        <nav className={`mono ${styles.tabs}`} aria-label={l(SECTION.tabsAria)}>
          {SERVICES.map((s, i) => (
            <Link
              key={s.slug}
              href={directionHref(s.slug)}
              className={`${styles.tab} ${i === active ? styles.tabActive : ""}`}
              aria-current={i === active ? "true" : undefined}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
            >
              {l(s.tab)}
            </Link>
          ))}
        </nav>

        <div className={styles.panel}>
          <div className={styles.copy}>
            <div className={`mono ${styles.tag}`}>{l(svc.tag)}</div>
            <h3 className={`disp ${styles.copyTitle}`}>{l(svc.title)}</h3>
            <p className={styles.copyText}>{l(svc.text)}</p>
            <ul className={styles.list}>
              {svc.list.map((item, i) => (
                <li key={i}>{l(item)}</li>
              ))}
            </ul>
            <Link href={directionHref(svc.slug)} className={styles.more}>
              {l(SECTION.more)} →
            </Link>
          </div>

          <div
            className={styles.visual}
            style={
              {
                "--sol-p1": palette?.p1,
                "--sol-p2": palette?.p2,
              } as CSSProperties
            }
          >
            <article className={styles.case}>
              <div className={`mono ${styles.caseTop}`}>
                <span>
                  {reference ? l(CASE.ref) : flow ? l(flow.cardLabel) : l(CASE.none)}
                </span>
                {reference && <b>{refNumber}</b>}
              </div>
              {reference ? (
                <>
                  <h4 className={`disp ${styles.caseName}`}>{reference.name}</h4>
                  <p className={styles.caseText}>{l(reference.desc)}</p>
                  <div className={`mono ${styles.caseTags}`}>
                    {tagChips(l(reference.tag)).map((chip) => (
                      <span key={chip}>{chip}</span>
                    ))}
                  </div>
                </>
              ) : flow ? (
                <>
                  <h4 className={`disp ${styles.caseName} ${styles.caseFlowName}`}>
                    {l(flow.cardTitle)}
                  </h4>
                  <ol className={styles.flow}>
                    {flow.flow?.map((step, i) => (
                      <li key={i}>
                        <b className="mono">{String(i + 1).padStart(2, "0")}</b>
                        <span>{l(step)}</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className={styles.caseText}>{l(CASE.noneText)}</p>
              )}
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
