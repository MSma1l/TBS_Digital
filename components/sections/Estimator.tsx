"use client";

import { useState, type FormEvent } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Estimator.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const SECTION = {
  eyebrow: L("Cerere / estimare", "Заявка / оценка", "Request / estimate"),
  title: L("Spune-ne ce vrei să construiești.", "Расскажите, что хотите построить.", "Tell us what you want to build."),
  lead: L(
    "Un dialog scurt clarifică cererea, iar rezumatul se atașează automat propunerii.",
    "Короткий диалог уточняет запрос, а его résumé автоматически прикрепляется к предложению.",
    "A short dialog clarifies the request, and its summary is attached to the proposal automatically.",
  ),
  step1: L("01 · TIP PROIECT", "01 · ТИП ПРОЕКТА", "01 · PROJECT TYPE"),
  step2: L("02 · OPȚIUNI CARE CONTEAZĂ", "02 · ЧТО ВАЖНО ДОБАВИТЬ", "02 · OPTIONS THAT MATTER"),
  proposal: L("PROPUNEREA TA", "ВАШЕ ПРЕДЛОЖЕНИЕ", "YOUR PROPOSAL"),
  from: L("de la", "от", "from"),
  assistant: L("Asistent TBS · online", "Ассистент TBS · онлайн", "TBS assistant · online"),
  submit: L("Trimite cererea", "Отправить заявку", "Send the request"),
  submitted: L("Cerere pregătită ✓", "Заявка готова ✓", "Request ready ✓"),
};

type PType = { label: LocalizedText; price: string };
const PROJECT_TYPES: PType[] = [
  { label: L("Site / prezentare", "Сайт / презентация", "Website / landing"), price: "€3.000" },
  { label: L("CRM la comandă", "CRM под заказ", "Custom CRM"), price: "€8.000" },
  { label: L("Automatizare cu AI", "Автоматизация с ИИ", "AI automation"), price: "€5.000" },
  { label: L("E-commerce", "E-commerce", "E-commerce"), price: "€6.000" },
  { label: L("Aplicație mobilă", "Мобильное приложение", "Mobile app"), price: "€12.000" },
];

const OPTIONS: LocalizedText[] = [
  L("+ Design premium", "+ Премиум-дизайн", "+ Premium design"),
  L("+ Integrări & API", "+ Интеграции и API", "+ Integrations & API"),
  L("+ Multilingv", "+ Мультиязычность", "+ Multilingual"),
  L("+ SEO", "+ SEO", "+ SEO"),
];

const RESULT_COPY = L(
  "Include direcție UX, design și o discuție tehnică despre integrări.",
  "Включает UX-направление, дизайн и техническое обсуждение интеграций.",
  "Includes UX direction, design and a technical discussion about integrations.",
);

const PLACEHOLDERS = {
  name: L("Nume și companie", "Имя и компания", "Name and company"),
  email: L("Email", "Email", "Email"),
  phone: L("Telefon (opțional)", "Телефон (необязательно)", "Phone (optional)"),
  details: L("Adaugă orice detaliu important", "Добавьте любую важную деталь", "Add any important detail"),
};

/* ---------- chat assistant tree ---------- */
type Opt = { label: LocalizedText; next: string };
type Node = { q: LocalizedText; options: Opt[] };

const TREE: Record<string, Node> = {
  start: {
    q: L(
      "Bună! Care este obiectivul principal al proiectului tău?",
      "Привет! Какая главная цель вашего проекта?",
      "Hi! What is the main goal of your project?",
    ),
    options: [
      { label: L("Mai mulți clienți", "Больше клиентов", "More clients"), next: "growth" },
      { label: L("Mai puțină rutină", "Меньше рутины", "Less routine"), next: "automation" },
      { label: L("Un produs nou", "Новый продукт", "A new product"), next: "product" },
    ],
  },
  growth: {
    q: L(
      "Unde se pierd cel mai des potențialii clienți?",
      "Где чаще всего теряются потенциальные клиенты?",
      "Where do potential clients get lost most often?",
    ),
    options: [
      { label: L("Nu ne găsesc online", "Нас не находят онлайн", "They don't find us online"), next: "channel" },
      { label: L("Site-ul nu convinge", "Сайт не убеждает", "The site doesn't convince"), next: "channel" },
      { label: L("Nu urmărim lead-urile", "Не отслеживаем лиды", "We don't track leads"), next: "channel" },
    ],
  },
  channel: {
    q: L(
      "Ce canal vrei să îmbunătățim mai întâi?",
      "Какой канал улучшаем первым?",
      "Which channel should we improve first?",
    ),
    options: [
      { label: L("Site / landing page", "Сайт / лендинг", "Site / landing page"), next: "timeline" },
      { label: L("Google sau SEO", "Google или SEO", "Google or SEO"), next: "timeline" },
      { label: L("Social media / campanii", "Соцсети / кампании", "Social media / campaigns"), next: "timeline" },
    ],
  },
  automation: {
    q: L(
      "Ce activitate consumă acum cel mai mult timp?",
      "Что сейчас отнимает больше всего времени?",
      "Which activity consumes the most time now?",
    ),
    options: [
      { label: L("Documente și aprobări", "Документы и согласования", "Documents and approvals"), next: "systems" },
      { label: L("Lead-uri și vânzări", "Лиды и продажи", "Leads and sales"), next: "systems" },
      { label: L("Rapoarte și date", "Отчёты и данные", "Reports and data"), next: "systems" },
    ],
  },
  systems: {
    q: L(
      "Cu ce trebuie să se conecteze soluția?",
      "С чем должно соединяться решение?",
      "What should the solution connect to?",
    ),
    options: [
      { label: L("CRM sau ERP", "CRM или ERP", "CRM or ERP"), next: "timeline" },
      { label: L("Facturare / plăți", "Счета / платежи", "Invoicing / payments"), next: "timeline" },
      { label: L("Fișiere și e-mail", "Файлы и e-mail", "Files and e-mail"), next: "timeline" },
      { label: L("Nu știm încă", "Пока не знаем", "Not sure yet"), next: "timeline" },
    ],
  },
  product: {
    q: L(
      "Cine va folosi cel mai des produsul?",
      "Кто будет чаще всего пользоваться продуктом?",
      "Who will use the product most often?",
    ),
    options: [
      { label: L("Clienții noștri", "Наши клиенты", "Our clients"), next: "shape" },
      { label: L("Echipa internă", "Внутренняя команда", "The internal team"), next: "shape" },
      { label: L("O piață nouă", "Новый рынок", "A new market"), next: "shape" },
    ],
  },
  shape: {
    q: L(
      "Ce formă ți se potrivește mai bine?",
      "Какая форма подходит лучше?",
      "Which shape fits you best?",
    ),
    options: [
      { label: L("Platformă web", "Веб-платформа", "Web platform"), next: "timeline" },
      { label: L("Aplicație mobilă", "Мобильное приложение", "Mobile app"), next: "timeline" },
      { label: L("SaaS cu abonament", "SaaS по подписке", "Subscription SaaS"), next: "timeline" },
    ],
  },
  timeline: {
    q: L(
      "Când vrei să înceapă proiectul?",
      "Когда хотите начать проект?",
      "When do you want the project to start?",
    ),
    options: [
      { label: L("În următoarele 3 săptămâni", "В ближайшие 3 недели", "In the next 3 weeks"), next: "budget" },
      { label: L("În 1–2 luni", "Через 1–2 месяца", "In 1–2 months"), next: "budget" },
      { label: L("După validare internă", "После внутренней проверки", "After internal validation"), next: "budget" },
    ],
  },
  budget: {
    q: L(
      "Ce nivel de investiție ai în vedere?",
      "Какой уровень инвестиций рассматриваете?",
      "What investment level do you have in mind?",
    ),
    options: [
      { label: L("Sub €5.000", "До €5.000", "Under €5.000"), next: "finish" },
      { label: L("€5.000–€15.000", "€5.000–€15.000", "€5.000–€15.000"), next: "finish" },
      { label: L("Peste €15.000", "Более €15.000", "Over €15.000"), next: "finish" },
      { label: L("Vreau recomandarea TBS", "Хочу рекомендацию TBS", "I want TBS's recommendation"), next: "finish" },
    ],
  },
};

const FINISH = L(
  "Mulțumesc! Am adaptat propunerea și am adăugat conversația în cerere. Completează datele de contact pentru a o trimite.",
  "Спасибо! Мы адаптировали предложение и добавили разговор в заявку. Заполните контакты, чтобы отправить её.",
  "Thank you! We've adapted the proposal and added the conversation to the request. Fill in your contacts to send it.",
);

type Bubble = { id: number; text: string; user: boolean };

export function Estimator() {
  const l = useLoc();
  const [typeIndex, setTypeIndex] = useState(0);
  const [opts, setOpts] = useState<Set<number>>(new Set([1]));
  const [node, setNode] = useState("start");
  const [log, setLog] = useState<Bubble[]>([]);
  const [uid, setUid] = useState(1);
  const [sent, setSent] = useState(false);

  const price = `${l(SECTION.from)} ${PROJECT_TYPES[typeIndex].price}`;

  const current = node === "finish" ? null : TREE[node];

  const toggleOpt = (i: number) =>
    setOpts((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(i)) nextSet.delete(i);
      else nextSet.add(i);
      return nextSet;
    });

  const pick = (opt: Opt) => {
    if (node === "finish") return;
    const answer = l(opt.label);
    const userBubble: Bubble = { id: uid, text: answer, user: true };
    let nextId = uid + 1;
    const bubbles: Bubble[] = [userBubble];
    if (opt.next !== "finish") {
      bubbles.push({ id: nextId, text: l(TREE[opt.next].q), user: false });
      nextId += 1;
    } else {
      bubbles.push({ id: nextId, text: l(FINISH), user: false });
      nextId += 1;
    }
    setLog((prev) => [...prev, ...bubbles]);
    setUid(nextId);
    setNode(opt.next);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <section id="estimare" className={styles.section}>
      <div className="container">
        <Reveal className={styles.top}>
          <div>
            <div className={`mono ${styles.eyebrow}`}>{l(SECTION.eyebrow)}</div>
            <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
          </div>
          <p className={styles.lead}>{l(SECTION.lead)}</p>
        </Reveal>

        <div className={styles.box}>
          <div className={styles.steps}>
            <div>
              <div className={`mono ${styles.stepLabel}`}>{l(SECTION.step1)}</div>
              <div className={styles.choices}>
                {PROJECT_TYPES.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.choice} ${i === typeIndex ? styles.selected : ""}`}
                    onClick={() => setTypeIndex(i)}
                  >
                    {l(p.label)}
                  </button>
                ))}
              </div>

              <div className={`mono ${styles.stepLabel}`}>{l(SECTION.step2)}</div>
              <div className={styles.choices}>
                {OPTIONS.map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.choice} ${opts.has(i) ? styles.selected : ""}`}
                    onClick={() => toggleOpt(i)}
                  >
                    {l(o)}
                  </button>
                ))}
              </div>

              <div className={styles.chat} aria-live="polite">
                <div className={`mono ${styles.chatHead}`}>
                  <span className={styles.chatDot} />
                  {l(SECTION.assistant)}
                </div>
                <div className={styles.chatLog}>
                  <div className={styles.bubble}>{l(TREE.start.q)}</div>
                  {log.map((b) => (
                    <div
                      key={b.id}
                      className={`${styles.bubble} ${b.user ? styles.bubbleUser : ""}`}
                    >
                      {b.text}
                    </div>
                  ))}
                </div>
                {current && (
                  <div className={styles.chatOptions}>
                    {current.options.map((o, i) => (
                      <button
                        key={i}
                        type="button"
                        className={styles.chatOption}
                        onClick={() => pick(o)}
                      >
                        {l(o.label)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className={styles.result}>
              <div className={`mono ${styles.stepLabel}`}>{l(SECTION.proposal)}</div>
              <b className={`disp ${styles.price}`}>{price}</b>
              <p className={styles.resultCopy}>{l(RESULT_COPY)}</p>
              <form className={styles.form} onSubmit={onSubmit}>
                <input aria-label={l(PLACEHOLDERS.name)} placeholder={l(PLACEHOLDERS.name)} required />
                <input
                  aria-label={l(PLACEHOLDERS.email)}
                  type="email"
                  placeholder={l(PLACEHOLDERS.email)}
                  required
                />
                <input
                  aria-label={l(PLACEHOLDERS.phone)}
                  type="tel"
                  placeholder={l(PLACEHOLDERS.phone)}
                />
                <textarea
                  aria-label={l(PLACEHOLDERS.details)}
                  placeholder={l(PLACEHOLDERS.details)}
                  rows={3}
                />
                <button type="submit" className={styles.submit}>
                  {sent ? l(SECTION.submitted) : l(SECTION.submit)}
                </button>
              </form>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
