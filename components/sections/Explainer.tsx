"use client";

import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Explainer.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/*
 * THE EXPLANATORY PARAGRAPH — step 6 of the copy framework's wireframe (docs/16, "Copy
 * framework"): the whole story retold in prose, for the visitor who reads to the end and for
 * search engines. The visitor's problem → TBS Digital as the guide → the three-step plan →
 * the result. It names the services the way people search for them (creare site-uri, magazin
 * online, aplicații, MVP, automatizări, Chișinău, Moldova) once each, in sentences, never as a
 * keyword list.
 *
 * Every promise here is one the site already makes elsewhere: the one-business-day reply (the
 * estimator's sent screen and the guide's FAQ), the plan's three steps (Process), the same team
 * from the first version on (Principles). No figure, no price, no deadline, no guarantee: the
 * prices are the owner's, read from the admin by the request section right after this one.
 */
const SECTION = {
  title: L(
    "Site-uri, aplicații și MVP în Chișinău, construite pas cu pas.",
    "Сайты, приложения и MVP в Кишинёве — шаг за шагом.",
    "Websites, apps and MVPs in Chișinău, built step by step.",
  ),
};

const PARAGRAPHS: LocalizedText[] = [
  L(
    "Ai o afacere sau o idee și știi că online se poate mai mult: mai mulți clienți, mai puțină muncă manuală, un produs nou. Dar nu știi de unde să începi, iar o dezvoltare mare, plătită dinainte, e un risc pe care nu vrei să-l iei pe o idee netestată.",
    "У вас есть бизнес или идея, и вы знаете, что онлайн можно больше: больше клиентов, меньше ручной работы, новый продукт. Но непонятно, с чего начать, а большая разработка с оплатой вперёд — риск, на который не хочется идти с непроверенной идеей.",
    "You have a business or an idea, and you know you could do more online: more customers, less manual work, a new product. But it's hard to know where to start, and a big build paid up front is a risk you don't want to take on an untested idea.",
  ),
  L(
    "TBS Digital este o echipă de dezvoltare din Chișinău, Moldova. Ne ocupăm de creare de site-uri și magazine online, aplicații mobile și web, MVP-uri, asistenți IA, boți Telegram, CRM și automatizări. Nu pornim de la o listă lungă de funcții, ci de la problema ta: ne spui ideea, în cel mult o zi lucrătoare revenim cu întrebări concrete, stabilim împreună prima versiune și prețul ei, apoi o lansăm.",
    "TBS Digital — команда разработки из Кишинёва, Молдова. Мы создаём сайты и интернет-магазины, мобильные и веб-приложения, MVP, ИИ-ассистентов, Telegram-ботов, CRM и автоматизацию. Начинаем не с длинного списка функций, а с вашей задачи: вы рассказываете идею, не позже чем через рабочий день мы возвращаемся с конкретными вопросами, вместе определяем первую версию и её цену, а затем запускаем её.",
    "TBS Digital is a development team in Chișinău, Moldova. We build websites and online stores, mobile and web apps, MVPs, AI assistants, Telegram bots, CRMs and automations. We don't start from a long feature list but from your problem: you tell us the idea, within one business day we come back with concrete questions, together we agree the first version and its price, and then we launch it.",
  ),
  L(
    "Testezi prima versiune cu clienți reali și vezi ce funcționează înainte să investești mai mult. Aceeași echipă dezvoltă apoi doar ce aduce rezultat: de la un site de prezentare la un magazin online sau la un sistem care leagă vânzările, documentele și plățile. Câștigi timp, ții bugetul sub control și crești pe baza datelor, nu a presupunerilor.",
    "Вы проверяете первую версию на реальных клиентах и видите, что работает, прежде чем вкладывать больше. Затем та же команда развивает только то, что приносит результат: от сайта-визитки до интернет-магазина или системы, которая связывает продажи, документы и платежи. Вы экономите время, держите бюджет под контролем и растёте на данных, а не на догадках.",
    "You test the first version with real customers and see what works before you invest more. The same team then develops only what brings results: from a presentation site to an online store or a system that connects your sales, documents and payments. You save time, keep the budget under control and grow on data, not guesswork.",
  ),
];

/** Anchor of the section (`/#pe-scurt`). */
export const EXPLAINER_ID = "pe-scurt";

export function Explainer() {
  const l = useLoc();

  return (
    <section id={EXPLAINER_ID} className={styles.section}>
      <div className="container">
        <Reveal className={styles.inner}>
          <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
          <div className={styles.body}>
            {PARAGRAPHS.map((text, i) => (
              <p key={i} className={styles.text}>
                {l(text)}
              </p>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
