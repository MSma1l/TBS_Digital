"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { directionHref } from "@/lib/directions";
import { projectsForSolution, solutionPalette } from "@/lib/solutions";
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
    tab: L("E-commerce", "E-commerce", "E-commerce"),
    tag: L("PENTRU VÂNZARE MAI SIMPLĂ", "ДЛЯ ПРОСТЫХ ПРОДАЖ", "FOR SIMPLER SELLING"),
    title: L("E-commerce", "E-commerce", "E-commerce"),
    text: L(
      "Construim experiențe de cumpărare rapide, clare și optimizate pentru conversie.",
      "Строим быстрый, понятный и оптимизированный под конверсию опыт покупки.",
      "We build fast, clear buying experiences optimized for conversion.",
    ),
    list: [
      L("Arhitectură de catalog", "Архитектура каталога", "Catalog architecture"),
      L("Checkout fără fricțiune", "Оформление без трения", "Frictionless checkout"),
      L("Analytics și optimizare", "Аналитика и оптимизация", "Analytics and optimization"),
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
    tab: L("Asistenți IA & boturi", "ИИ-ассистенты и боты", "AI assistants & bots"),
    tag: L("IA CARE LUCREAZĂ CU ECHIPA", "ИИ, КОТОРЫЙ РАБОТАЕТ С КОМАНДОЙ", "AI THAT WORKS WITH YOUR TEAM"),
    title: L("Asistenți IA & boturi", "ИИ-ассистенты и боты", "AI assistants & bots"),
    text: L(
      "Construim asistenți care răspund, califică cereri și pornesc procese în web, Telegram sau sistemele interne.",
      "Создаём ассистентов, которые отвечают, квалифицируют заявки и запускают процессы в вебе, Telegram или внутренних системах.",
      "We build assistants that answer, qualify requests and trigger processes in web, Telegram or internal systems.",
    ),
    list: [
      L("Chatbot pentru clienți", "Чат-бот для клиентов", "Chatbot for clients"),
      L("Asistent IA pentru echipă", "ИИ-ассистент для команды", "AI assistant for the team"),
      L("Bot Telegram conectat la API", "Telegram-бот с подключением к API", "Telegram bot connected to your API"),
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
  /** Shown when a direction has no delivered project yet — stated plainly rather than
   *  filled with a project that belongs to another direction. */
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
                <span>{reference ? l(CASE.ref) : l(CASE.none)}</span>
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
