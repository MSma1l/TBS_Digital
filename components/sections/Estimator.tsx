"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { deadlines, features, PRICE_PLACEHOLDER } from "@/lib/content";
import { useSiteContent } from "@/lib/siteContent";
import { ESTIMATE_EVENT } from "@/lib/estimatorBridge";
import { submitContact, isNetworkError } from "@/lib/api";
import { LIMITS, validateText, sanitizeText } from "@/lib/validation";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useContentText } from "@/lib/i18n/content";
import { format, Multiline } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/messages";
import styles from "./Estimator.module.css";

export function Estimator() {
  const t = useT();
  const tc = useContentText();
  // The project-type list IS the services list (name + price) — same source as /03.
  const { services: projectTypes } = useSiteContent();
  const priceOf = (id: string) =>
    projectTypes.find((p) => p.id === id)?.price || PRICE_PLACEHOLDER;

  const [project, setProject] = useState("site");
  const [deadline, setDeadline] = useState("standard");
  const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>(
    {},
  );

  // Contact-form fields + submission lifecycle.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  // Per-field errors are shown once a field is touched or a submit is attempted.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);

  // A click on a /03 service card pre-selects that service here (and scrolls us into
  // view), so the visitor lands on the estimator with their choice already made.
  useEffect(() => {
    const onEstimate = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (projectTypes.some((p) => p.id === id)) setProject(id);
    };
    window.addEventListener(ESTIMATE_EVENT, onEstimate);
    return () => window.removeEventListener(ESTIMATE_EVENT, onEstimate);
  }, [projectTypes]);

  const toggleFeature = (id: string) =>
    setActiveFeatures((f) => ({ ...f, [id]: !f[id] }));

  const selectedProjectName =
    projectTypes.find((p) => p.id === project)?.name ?? "";

  // Live validation mirroring the backend limits (name/email required, phone
  // optional, hard max lengths, HTML/script injection blocked).
  const nameErr = validateText(name, {
    label: t("estimator.field.name"),
    max: LIMITS.name,
    required: true,
  });
  const emailErr = validateText(email, {
    label: t("estimator.field.email"),
    max: LIMITS.email,
    required: true,
    email: true,
  });
  const phoneErr = validateText(phone, {
    label: t("estimator.field.phone"),
    max: LIMITS.phone,
    phone: true,
  });
  const messageErr = validateText(message, {
    label: t("estimator.field.message"),
    max: LIMITS.message,
    required: true,
  });
  const formInvalid = !!(nameErr || emailErr || phoneErr || messageErr);
  const touch = (field: string) =>
    setTouched((t) => ({ ...t, [field]: true }));
  const showErr = (field: string, err: string | null) =>
    (attempted || touched[field]) && err ? err : null;

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setFormError("");
    setTouched({});
    setAttempted(false);
    setSent(false);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAttempted(true);
    if (formInvalid) return;

    setFormError("");
    setSubmitting(true);
    try {
      await submitContact({
        name: sanitizeText(name),
        email: sanitizeText(email),
        phone: sanitizeText(phone),
        message: sanitizeText(message),
        project: selectedProjectName,
        estimate: priceOf(project),
      });
      setSent(true);
    } catch (err) {
      setFormError(
        isNetworkError(err)
          ? t("estimator.error.network")
          : t("estimator.error.failed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className={styles.section}>
      <div className={styles.glow} aria-hidden />
      <div className={`container ${styles.inner}`}>
        <div className={styles.head}>
          <SectionLabel index="/07">{t("estimator.label")}</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            <Multiline text={t("estimator.title")} />
          </h2>
          <p className={styles.lead}>{t("estimator.lead")}</p>
        </div>

        <div className={styles.grid}>
          {/* ---------- estimator ---------- */}
          <div className={styles.estimator}>
            <div className={`mono ${styles.groupLabel}`}>
              {t("estimator.group.type")}
            </div>
            <div className={styles.typeGrid}>
              {projectTypes.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProject(opt.id)}
                  className={`${styles.typeBtn} ${
                    project === opt.id ? styles.active : ""
                  }`}
                >
                  <div className={`mono ${styles.typeName}`}>
                    {tc(`services.${opt.id}.name` as MessageKey, opt.name)}
                  </div>
                  <div className={`mono ${styles.typePrice}`}>
                    {format(t("estimator.price.from"), {
                      price: priceOf(opt.id),
                    })}
                  </div>
                </button>
              ))}
            </div>

            <div className={`mono ${styles.groupLabel}`}>
              {t("estimator.group.deadline")}
            </div>
            <div className={styles.deadlineRow}>
              {deadlines.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDeadline(opt.id)}
                  className={`${styles.deadlineBtn} ${
                    deadline === opt.id ? styles.active : ""
                  }`}
                >
                  <div className={`mono ${styles.deadlineName}`}>
                    {t(`deadlines.${opt.id}.name` as MessageKey)}
                  </div>
                  <div className={`mono ${styles.deadlineNote}`}>
                    {t(`deadlines.${opt.id}.note` as MessageKey)}
                  </div>
                </button>
              ))}
            </div>

            <div className={`mono ${styles.groupLabel}`}>
              {t("estimator.group.options")}
            </div>
            <div className={styles.featureRow}>
              {features.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleFeature(opt.id)}
                  className={`mono ${styles.chip} ${
                    activeFeatures[opt.id] ? styles.chipActive : ""
                  }`}
                >
                  {t(`features.${opt.id}.label` as MessageKey)}
                </button>
              ))}
            </div>

            <div className={styles.total}>
              <div className={`mono ${styles.totalLabel}`}>
                {t("estimator.total.label")}
              </div>
              <div className={`disp ${styles.totalValue}`}>
                {priceOf(project)}
              </div>
              <div className={`mono ${styles.totalNote}`}>
                {t("estimator.total.note")}
              </div>
            </div>
          </div>

          {/* ---------- form ---------- */}
          <div className={styles.form}>
            {sent ? (
              <div className={styles.sent}>
                <div className={styles.check}>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className={`disp ${styles.sentTitle}`}>
                  {t("estimator.sent.title")}
                </h3>
                <p className={styles.sentText}>
                  {format(t("estimator.sent.text"), {
                    project: selectedProjectName,
                  })}
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className={`mono ${styles.resetBtn}`}
                >
                  {t("estimator.sent.reset")}
                </button>
              </div>
            ) : (
              <>
                <h3 className={`disp ${styles.formTitle}`}>
                  {t("estimator.form.title")}
                </h3>
                <p className={styles.formSub}>{t("estimator.form.sub")}</p>
                <form onSubmit={onSubmit} className={styles.fields} noValidate>
                  <div className={styles.fieldWrap}>
                    <input
                      required
                      value={name}
                      maxLength={LIMITS.name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => touch("name")}
                      placeholder={t("estimator.form.namePlaceholder")}
                      aria-invalid={!!showErr("name", nameErr)}
                      className={`mono ${styles.input}`}
                      disabled={submitting}
                    />
                    {showErr("name", nameErr) && (
                      <span className={`mono ${styles.fieldError}`}>{nameErr}</span>
                    )}
                  </div>
                  <div className={styles.fieldWrap}>
                    <input
                      required
                      type="email"
                      value={email}
                      maxLength={LIMITS.email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => touch("email")}
                      placeholder={t("estimator.form.emailPlaceholder")}
                      aria-invalid={!!showErr("email", emailErr)}
                      className={`mono ${styles.input}`}
                      disabled={submitting}
                    />
                    {showErr("email", emailErr) && (
                      <span className={`mono ${styles.fieldError}`}>{emailErr}</span>
                    )}
                  </div>
                  <div className={styles.fieldWrap}>
                    <input
                      value={phone}
                      maxLength={LIMITS.phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => touch("phone")}
                      placeholder={t("estimator.form.phonePlaceholder")}
                      aria-invalid={!!showErr("phone", phoneErr)}
                      className={`mono ${styles.input}`}
                      disabled={submitting}
                    />
                    {showErr("phone", phoneErr) && (
                      <span className={`mono ${styles.fieldError}`}>{phoneErr}</span>
                    )}
                  </div>
                  <div className={styles.fieldWrap}>
                    <textarea
                      rows={4}
                      value={message}
                      maxLength={LIMITS.message}
                      onChange={(e) => setMessage(e.target.value)}
                      onBlur={() => touch("message")}
                      placeholder={t("estimator.form.messagePlaceholder")}
                      aria-invalid={!!showErr("message", messageErr)}
                      className={`mono ${styles.textarea}`}
                      disabled={submitting}
                    />
                    {showErr("message", messageErr) && (
                      <span className={`mono ${styles.fieldError}`}>{messageErr}</span>
                    )}
                  </div>
                  <div className={`mono ${styles.estimateNote}`}>
                    {format(t("estimator.form.estimateAttached"), {
                      price: priceOf(project),
                      project: selectedProjectName,
                    })}
                  </div>
                  {formError && (
                    <div className={`mono ${styles.formError}`}>{formError}</div>
                  )}
                  <button
                    type="submit"
                    className={`mono ${styles.submit}`}
                    disabled={submitting || (attempted && formInvalid)}
                  >
                    {submitting
                      ? t("estimator.submit.sending")
                      : t("estimator.submit.idle")}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
