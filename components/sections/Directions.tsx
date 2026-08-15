"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Directions.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

type Service = {
  slug: string;
  tab: LocalizedText;
  tag: LocalizedText;
  title: LocalizedText;
  text: LocalizedText;
  list: LocalizedText[];
  v1: string;
  v2: string;
};

const SERVICES: Service[] = [
  {
    slug: "digital",
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
    v1: "#dce8ff",
    v2: "#b9d5ff",
  },
  {
    slug: "ecommerce",
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
    v1: "#ffe1de",
    v2: "#ffc1be",
  },
  {
    slug: "automation",
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
    v1: "#d9faeb",
    v2: "#a9edd8",
  },
  {
    slug: "ai",
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
    v1: "#e9ddff",
    v2: "#cbb8ff",
  },
  {
    slug: "brand",
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
    v1: "#fff0bf",
    v2: "#ffd778",
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
    "Selectează o direcție. Conținutul se schimbă instant, iar următorul pas rămâne mereu evident.",
    "Выберите направление. Контент меняется мгновенно, а следующий шаг всегда очевиден.",
    "Pick a direction. The content changes instantly and the next step is always obvious.",
  ),
  cta: L("Vorbește cu echipa", "Обсудить с командой", "Talk to the team"),
  more: L("Deschide pagina direcției", "Открыть страницу направления", "Open the direction page"),
};

const CASE = {
  top: L("PROIECT REAL / WEB PLATFORM", "РЕАЛЬНЫЙ ПРОЕКТ / WEB PLATFORM", "REAL PROJECT / WEB PLATFORM"),
  text: L(
    "Platformă de autoevaluare a riscurilor pentru IMM-uri, cu teste interactive și raport PDF.",
    "Платформа самооценки рисков для МСБ с интерактивными тестами и PDF-отчётом.",
    "A risk self-assessment platform for SMEs with interactive tests and a PDF report.",
  ),
  link: L("Vezi proiectul ↗", "Смотреть проект ↗", "View the project ↗"),
};

export function Directions() {
  const l = useLoc();
  const [active, setActive] = useState(0);
  const svc = SERVICES[active];

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

        <div className={`mono ${styles.tabs}`} role="tablist">
          {SERVICES.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`${styles.tab} ${i === active ? styles.tabActive : ""}`}
              onClick={() => setActive(i)}
            >
              {l(s.tab)}
            </button>
          ))}
        </div>

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
            <div className={styles.actions}>
              <a href="#estimare" className={styles.cta}>
                {l(SECTION.cta)}
              </a>
              <Link href={`/solutions/${svc.slug}`} className={styles.more}>
                {l(SECTION.more)} ↗
              </Link>
            </div>
          </div>

          <div
            className={styles.visual}
            style={{ "--v1": svc.v1, "--v2": svc.v2 } as CSSProperties}
          >
            <article className={styles.case}>
              <div className={`mono ${styles.caseTop}`}>
                <span>{l(CASE.top)}</span>
                <b>01</b>
              </div>
              <h4 className={`disp ${styles.caseName}`}>BizCheck</h4>
              <p className={styles.caseText}>{l(CASE.text)}</p>
              <div className={`mono ${styles.caseTags}`}>
                <span>UX/UI</span>
                <span>{l(L("Platformă", "Платформа", "Platform"))}</span>
                <span>PDF</span>
              </div>
              <a
                href="https://bizcheck.md"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.caseLink}
              >
                {l(CASE.link)}
              </a>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
