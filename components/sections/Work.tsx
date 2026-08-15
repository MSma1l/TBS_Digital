"use client";

import { type CSSProperties } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Work.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

type Project = {
  index: string;
  name: string;
  tag: LocalizedText;
  desc: LocalizedText;
  url?: string;
  /** Background screenshot from /public/projects. Omit for a plain gradient card. */
  image?: string;
  p1: string;
  p2: string;
};

const SECTION = {
  eyebrow: L("Portofoliu TBS", "Портфолио TBS", "TBS portfolio"),
  title: L("Proiectele care ne reprezintă.", "Проекты, которые говорят за нас.", "The projects that speak for us."),
  lead: L(
    "De la platforme web la aplicații mobile — produse duse până la lansare.",
    "От веб-платформ до мобильных приложений — продукты, доведённые до запуска.",
    "From web platforms to mobile apps — products taken all the way to launch.",
  ),
};

const PROJECTS: Project[] = [
  {
    index: "01",
    name: "BizCheck",
    tag: L("WEB PLATFORM", "WEB PLATFORM", "WEB PLATFORM"),
    desc: L(
      "Autoevaluare de risc pentru IMM-uri: teste interactive, template-uri juridice și raport PDF.",
      "Самооценка рисков для МСБ: интерактивные тесты, юридические шаблоны и PDF-отчёт.",
      "Risk self-assessment for SMEs: interactive tests, legal templates and a PDF report.",
    ),
    url: "https://bizcheck.md",
    image: "/projects/bizcheck-1.jpg",
    p1: "#192f6f",
    p2: "#4b7dff",
  },
  {
    index: "02",
    name: "Itara Global",
    tag: L("CORPORATE WEBSITE", "CORPORATE WEBSITE", "CORPORATE WEBSITE"),
    desc: L(
      "Site corporativ cu servicii IT, proof points și experiență optimizată pentru conversie.",
      "Корпоративный сайт с IT-услугами, доказательной базой и оптимизацией под конверсию.",
      "A corporate site with IT services, proof points and a conversion-optimized experience.",
    ),
    url: "https://itara-global.md",
    image: "/projects/itara-1.jpg",
    p1: "#173b3d",
    p2: "#10a99b",
  },
  {
    index: "03",
    name: "DocuSafe",
    tag: L("CRM PRIVAT · FĂRĂ LINK", "ПРИВАТНЫЙ CRM · БЕЗ ССЫЛКИ", "PRIVATE CRM · NO LINK"),
    desc: L(
      "CRM privat de documente construit pentru un client — nu poate fi publicat. Stocare securizată, roluri, editare, categorii și căutare completă.",
      "Приватный CRM для документов под клиента — публиковать нельзя. Защищённое хранение, роли, редактирование, категории и полный поиск.",
      "A private document CRM built for a client — it cannot be published. Secure storage, roles, editing, categories and full-text search.",
    ),
    image: "/projects/docusafe-1.png",
    p1: "#6d2348",
    p2: "#e5527d",
  },
  {
    index: "04",
    name: "Crowe Portal",
    tag: L("CRM PRIVAT · FĂRĂ LINK", "ПРИВАТНЫЙ CRM · БЕЗ ССЫЛКИ", "PRIVATE CRM · NO LINK"),
    desc: L(
      "Portal intern de lucru pentru un client — nu poate fi publicat. Sarcini pe board (backlog → în lucru → verificare → trimis), tichete, clienți, ședințe și rapoarte.",
      "Внутренний рабочий портал под клиента — публиковать нельзя. Задачи на доске (бэклог → в работе → проверка → отправлено), тикеты, клиенты, встречи и отчёты.",
      "An internal work portal built for a client — it cannot be published. Board tasks (backlog → in progress → review → sent), tickets, clients, meetings and reports.",
    ),
    image: "/projects/crowe-portal-1.png",
    p1: "#1b2a52",
    p2: "#3f63d8",
  },
  {
    index: "05",
    name: "CGAM",
    tag: L("WEB PLATFORM", "WEB PLATFORM", "WEB PLATFORM"),
    desc: L(
      "Academie cu workshop-uri, ligă gamificată, calendar de evenimente și comunitate.",
      "Академия с воркшопами, геймифицированной лигой, календарём событий и сообществом.",
      "An academy with workshops, a gamified league, an events calendar and a community.",
    ),
    url: "https://cgam.md",
    image: "/projects/cgam-1.png",
    p1: "#53397d",
    p2: "#9671dd",
  },
  {
    index: "06",
    name: "IQ Arena",
    tag: L("MOBILE APP", "MOBILE APP", "MOBILE APP"),
    desc: L(
      "Aplicație pentru evenimente de dezbatere: roluri, timer, jurizare și rezultate în timp real.",
      "Приложение для дебатов: роли, таймер, судейство и результаты в реальном времени.",
      "An app for debate events: roles, timer, judging and real-time results.",
    ),
    image: "/projects/iq-arena-1.png",
    p1: "#734328",
    p2: "#e38a4f",
  },
  {
    index: "07",
    name: "Balloons Breeze",
    tag: L("WEB · EVENT BRAND", "WEB · EVENT-БРЕНД", "WEB · EVENT BRAND"),
    desc: L(
      "Site imersiv pentru un studio de aerodesign: scenă interactivă cu baloane, servicii pentru evenimente și cerere rapidă de ofertă.",
      "Иммерсивный сайт студии аэродизайна: интерактивная сцена с шарами, услуги для событий и быстрый запрос сметы.",
      "An immersive site for a balloon-design studio: an interactive balloon scene, event services and a fast quote request.",
    ),
    url: "https://balloonsbreeze.md/",
    image: "/projects/balloons-breeze-1.png",
    p1: "#3a1c10",
    p2: "#b3801f",
  },
  {
    index: "08",
    name: "Statistica.md",
    tag: L("PORTAL GUVERNAMENTAL", "ГОСУДАРСТВЕННЫЙ ПОРТАЛ", "GOVERNMENT PORTAL"),
    desc: L(
      "Portal public de date pentru Biroul Național de Statistică: indicatori-cheie, banca de date, publicații și căutare — clar și accesibil pentru toți.",
      "Публичный портал данных для Национального бюро статистики: ключевые показатели, банк данных, публикации и поиск — понятно и доступно для всех.",
      "A public data portal for the National Bureau of Statistics: key indicators, a data bank, publications and search — clear and accessible for everyone.",
    ),
    url: "https://statistica.gov.md",
    image: "/projects/statistica-1.png",
    p1: "#0d3a7a",
    p2: "#1f6fd0",
  },
  {
    index: "09",
    name: "Statistic",
    tag: L("SAAS PRIVAT · FĂRĂ LINK", "ПРИВАТНЫЙ SAAS · БЕЗ ССЫЛКИ", "PRIVATE SAAS · NO LINK"),
    desc: L(
      "Instrument propriu de web-analytics: vizualizări, sesiuni, click-uri și evoluție în timp pentru fiecare site — alternativă gratuită la serviciile cunoscute, cu accent pe SEO.",
      "Собственный инструмент веб-аналитики: просмотры, сессии, клики и динамика по каждому сайту — бесплатная альтернатива известным сервисам, с акцентом на SEO.",
      "An in-house web-analytics tool: views, sessions, clicks and trends for every site — a free alternative to well-known services, with a focus on SEO.",
    ),
    image: "/projects/statistic-1.png",
    p1: "#0f2a52",
    p2: "#3f7fe0",
  },
  {
    index: "10",
    name: "FLIRT",
    tag: L("APLICAȚIE MOBILĂ · ÎN CURÂND", "МОБИЛЬНОЕ ПРИЛОЖЕНИЕ · СКОРО", "MOBILE APP · COMING SOON"),
    desc: L(
      "Aplicație mobilă de dating, în curând pe piață: profiluri, matching și conversații într-un design rapid, cu toleranță zero la conținut abuziv.",
      "Мобильное приложение для знакомств, скоро в релизе: анкеты, мэтчинг и переписка в быстром дизайне, с нулевой терпимостью к оскорбительному контенту.",
      "A mobile dating app launching soon: profiles, matching and chat in a fast design, with zero tolerance for abusive content.",
    ),
    image: "/projects/flirt-1.png",
    p1: "#1a0510",
    p2: "#ff2d78",
  },
];

export function Work() {
  const l = useLoc();

  return (
    <section id="lucrari" className={styles.section}>
      <div className="container">
        <Reveal className={styles.top}>
          <div>
            <div className={`mono ${styles.eyebrow}`}>{l(SECTION.eyebrow)}</div>
            <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
          </div>
          <p className={styles.lead}>{l(SECTION.lead)}</p>
        </Reveal>

        <div className={styles.grid}>
          {PROJECTS.map((p) => {
            const style = { "--p1": p.p1, "--p2": p.p2 } as CSSProperties;
            const inner = (
              <>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    className={styles.image}
                  />
                ) : null}
                <span className={`disp ${styles.index}`} aria-hidden>
                  {p.index}
                </span>
                <small className={`mono ${styles.tag}`}>{l(p.tag)}</small>
                <h3 className={`disp ${styles.name}`}>{p.name}</h3>
                <p className={styles.desc}>{l(p.desc)}</p>
              </>
            );
            return p.url ? (
              <a
                key={p.index}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.project}
                style={style}
              >
                {inner}
              </a>
            ) : (
              <article key={p.index} className={styles.project} style={style}>
                {inner}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
