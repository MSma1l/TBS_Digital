"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useT } from "@/lib/i18n/LanguageProvider";
import { submitContact, isNetworkError, ApiError } from "@/lib/api";
import { validateText, LIMITS } from "@/lib/validation";
import { SERVICE_QUERY_KEY, SERVICE_TO_ESTIMATOR_TYPE } from "@/lib/directions";
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
  sending: L("Se trimite…", "Отправляется…", "Sending…"),
  // Was "Cerere pregătită ✓" / "Request ready ✓" while the form sent nothing at all —
  // wording that described the local state rather than a delivered request.
  submitted: L("Cerere trimisă ✓", "Заявка отправлена ✓", "Request sent ✓"),
};

const SENT_COPY = L(
  "Am primit cererea. Revenim în cel mult o zi lucrătoare.",
  "Мы получили заявку. Ответим в течение одного рабочего дня.",
  "We received your request. We'll get back to you within one business day.",
);

const ERRORS = {
  network: L(
    "Nu am putut contacta serverul. Verifică conexiunea și încearcă din nou.",
    "Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.",
    "We couldn't reach the server. Check your connection and try again.",
  ),
  rate: L(
    "Prea multe cereri trimise. Încearcă din nou peste un minut.",
    "Слишком много заявок. Попробуйте через минуту.",
    "Too many requests. Please try again in a minute.",
  ),
  generic: L(
    "Cererea nu a putut fi trimisă. Încearcă din nou sau scrie-ne pe email.",
    "Заявку не удалось отправить. Попробуйте снова или напишите нам на почту.",
    "The request couldn't be sent. Try again or email us.",
  ),
};

/* Field names, as they appear inside a validation message ("Numele este obligatoriu."). */
const FIELD_LABELS = {
  name: L("Numele", "Имя", "The name"),
  email: L("Emailul", "Email", "The email"),
  phone: L("Telefonul", "Телефон", "The phone"),
};

/* Labels for the transcript that travels with the request — the assistant literally
   promises "am adăugat conversația în cerere", so it has to actually be in there. */
const TRANSCRIPT = {
  options: L("Opțiuni alese", "Выбранные опции", "Chosen options"),
  dialog: L("Dialog", "Диалог", "Dialog"),
  you: L("Client", "Клиент", "Client"),
  bot: L("Asistent", "Ассистент", "Assistant"),
  none: L("fără", "нет", "none"),
};

type PType = { id: string; label: LocalizedText; price: string };
const PROJECT_TYPES: PType[] = [
  { id: "site", label: L("Site / prezentare", "Сайт / презентация", "Website / landing"), price: "€3.000" },
  { id: "crm", label: L("CRM la comandă", "CRM под заказ", "Custom CRM"), price: "€8.000" },
  { id: "automation", label: L("Automatizare cu AI", "Автоматизация с ИИ", "AI automation"), price: "€5.000" },
  { id: "ecommerce", label: L("E-commerce", "E-commerce", "E-commerce"), price: "€6.000" },
  { id: "mobile", label: L("Aplicație mobilă", "Мобильное приложение", "Mobile app"), price: "€12.000" },
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

/**
 * Which type a visitor arriving from a service page should land on.
 *
 * The service pages link here as `/?serviciu=<slug>#estimare`, so the choice survives the
 * navigation, a refresh and a shared link — a CustomEvent would not. Read through
 * `useSearchParams` rather than `window.location` so the server and the first client
 * render agree and hydration stays quiet.
 */
function useServiceTypeIndex(): number {
  const params = useSearchParams();
  const slug = params.get(SERVICE_QUERY_KEY);
  if (!slug) return 0;
  const wanted = SERVICE_TO_ESTIMATOR_TYPE[slug];
  const found = PROJECT_TYPES.findIndex((t) => t.id === wanted);
  return found >= 0 ? found : 0;
}

export function Estimator() {
  const l = useLoc();
  const t = useT();
  /* `useT` is keyed by MessageKey; validateText takes a looser (key: string) => string.
     Wrapping keeps the catalog's typed keys everywhere except this one boundary. */
  const tr = (key: string) => t(key as Parameters<typeof t>[0]);
  const [typeIndex, setTypeIndex] = useState(useServiceTypeIndex);
  const [opts, setOpts] = useState<Set<number>>(new Set([1]));
  const [node, setNode] = useState("start");
  const [log, setLog] = useState<Bubble[]>([]);
  const [uid, setUid] = useState(1);

  /* The form is controlled so the request payload can carry what the visitor actually
     picked — the project type, the estimate and the dialog — not just the four inputs. */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<LocalizedText | null>(null);
  /* Per-field messages from lib/validation — the same rules the backend enforces, so a
     visitor is told what's wrong before a round trip rather than after a 422. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const sent = status === "sent";

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

  /** Everything the visitor chose, folded into the one free-text field the API takes. */
  const buildMessage = (): string => {
    const chosen = [...opts].sort().map((i) => l(OPTIONS[i]));
    const parts = [
      details.trim(),
      `${l(TRANSCRIPT.options)}: ${chosen.length ? chosen.join(", ") : l(TRANSCRIPT.none)}`,
    ];
    if (log.length) {
      const lines = log.map(
        (b) => `${b.user ? l(TRANSCRIPT.you) : l(TRANSCRIPT.bot)}: ${b.text}`,
      );
      parts.push(`${l(TRANSCRIPT.dialog)}:\n${lines.join("\n")}`);
    }
    // The API caps `message` at 5000 chars; trim rather than let the request 422.
    return parts.filter(Boolean).join("\n\n").slice(0, 5000);
  };

  /* Clear a field's message as soon as it's edited. Without this, "Numele este
     obligatoriu." stays under a field the visitor has just filled in, until the next
     submit — which reads as if the form were still refusing the value. */
  const editField =
    (key: "name" | "email" | "phone", set: (v: string) => void) => (value: string) => {
      set(value);
      setFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

  /** Client-side half of the defense-in-depth pair; the API re-validates everything. */
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const nameErr = validateText(
      name,
      { label: l(FIELD_LABELS.name), max: LIMITS.name, required: true },
      tr,
    );
    if (nameErr) next.name = nameErr;
    const emailErr = validateText(
      email,
      { label: l(FIELD_LABELS.email), max: LIMITS.email, required: true, email: true },
      tr,
    );
    if (emailErr) next.email = emailErr;
    // Phone is optional — validateText passes an empty value straight through.
    const phoneErr = validateText(
      phone,
      { label: l(FIELD_LABELS.phone), max: LIMITS.phone, phone: true },
      tr,
    );
    if (phoneErr) next.phone = phoneErr;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "sending") return; // double-submit guard
    setError(null);
    if (!validate()) {
      setStatus("idle");
      return;
    }
    setStatus("sending");
    try {
      await submitContact({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: buildMessage(),
        project: l(PROJECT_TYPES[typeIndex].label),
        estimate: PROJECT_TYPES[typeIndex].price,
      });
      setStatus("sent");
    } catch (err) {
      // 429 is the public endpoint's rate limit (10/min) — worth its own wording, so a
      // visitor who hit it knows to wait rather than assume the form is broken.
      const rateLimited = err instanceof ApiError && err.status === 429;
      setError(isNetworkError(err) ? ERRORS.network : rateLimited ? ERRORS.rate : ERRORS.generic);
      setStatus("error");
    }
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
              {/* noValidate: the browser's own bubble would fire first and our localized,
                  screen-reader-announced messages would never run. */}
              <form className={styles.form} onSubmit={onSubmit} noValidate>
                <input
                  aria-label={l(PLACEHOLDERS.name)}
                  placeholder={l(PLACEHOLDERS.name)}
                  value={name}
                  onChange={(e) => editField("name", setName)(e.target.value)}
                  maxLength={LIMITS.name}
                  aria-invalid={!!fieldErrors.name}
                  required
                />
                {fieldErrors.name && (
                  <p className={`${styles.formNote} ${styles.formError}`} role="alert">
                    {fieldErrors.name}
                  </p>
                )}
                <input
                  aria-label={l(PLACEHOLDERS.email)}
                  type="email"
                  placeholder={l(PLACEHOLDERS.email)}
                  value={email}
                  onChange={(e) => editField("email", setEmail)(e.target.value)}
                  maxLength={LIMITS.email}
                  aria-invalid={!!fieldErrors.email}
                  required
                />
                {fieldErrors.email && (
                  <p className={`${styles.formNote} ${styles.formError}`} role="alert">
                    {fieldErrors.email}
                  </p>
                )}
                <input
                  aria-label={l(PLACEHOLDERS.phone)}
                  type="tel"
                  placeholder={l(PLACEHOLDERS.phone)}
                  value={phone}
                  onChange={(e) => editField("phone", setPhone)(e.target.value)}
                  maxLength={LIMITS.phone}
                  aria-invalid={!!fieldErrors.phone}
                />
                {fieldErrors.phone && (
                  <p className={`${styles.formNote} ${styles.formError}`} role="alert">
                    {fieldErrors.phone}
                  </p>
                )}
                <textarea
                  aria-label={l(PLACEHOLDERS.details)}
                  placeholder={l(PLACEHOLDERS.details)}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={4000}
                  rows={3}
                />
                <button
                  type="submit"
                  className={styles.submit}
                  disabled={status === "sending" || sent}
                >
                  {status === "sending"
                    ? l(SECTION.sending)
                    : sent
                      ? l(SECTION.submitted)
                      : l(SECTION.submit)}
                </button>
                {/* Both outcomes are announced, so a screen-reader user isn't left
                    guessing whether the request actually went anywhere. */}
                {sent && (
                  <p className={styles.formNote} role="status">
                    {l(SENT_COPY)}
                  </p>
                )}
                {error && (
                  <p className={`${styles.formNote} ${styles.formError}`} role="alert">
                    {l(error)}
                  </p>
                )}
              </form>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
