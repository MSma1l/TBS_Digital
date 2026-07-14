"use client";

import { useState, type FormEvent } from "react";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { deadlines, features, PRICE_PLACEHOLDER } from "@/lib/content";
import { useSiteContent } from "@/lib/siteContent";
import { submitContact, isNetworkError } from "@/lib/api";
import { LIMITS, validateText, sanitizeText } from "@/lib/validation";
import styles from "./Estimator.module.css";

export function Estimator() {
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

  const toggleFeature = (id: string) =>
    setActiveFeatures((f) => ({ ...f, [id]: !f[id] }));

  const selectedProjectName =
    projectTypes.find((p) => p.id === project)?.name ?? "";

  // Live validation mirroring the backend limits (name/email required, phone
  // optional, hard max lengths, HTML/script injection blocked).
  const nameErr = validateText(name, {
    label: "Numele",
    max: LIMITS.name,
    required: true,
  });
  const emailErr = validateText(email, {
    label: "Emailul",
    max: LIMITS.email,
    required: true,
    email: true,
  });
  const phoneErr = validateText(phone, {
    label: "Telefonul",
    max: LIMITS.phone,
    phone: true,
  });
  const messageErr = validateText(message, {
    label: "Mesajul",
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
          ? "Serverul nu răspunde. Încearcă din nou în câteva momente."
          : "Trimiterea a eșuat. Te rugăm să încerci din nou.",
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
          <SectionLabel index="/07">HAI SĂ CONSTRUIM ÎMPREUNĂ</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            Estimează prețul
            <br />
            proiectului tău
          </h2>
          <p className={styles.lead}>
            Alege tipul de proiect, termenul limită și opțiunile — apoi trimite-ne
            detaliile.
          </p>
        </div>

        <div className={styles.grid}>
          {/* ---------- estimator ---------- */}
          <div className={styles.estimator}>
            <div className={`mono ${styles.groupLabel}`}>01 · TIP DE PROIECT</div>
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
                  <div className={`mono ${styles.typeName}`}>{opt.name}</div>
                  <div className={`mono ${styles.typePrice}`}>
                    de la {priceOf(opt.id)}
                  </div>
                </button>
              ))}
            </div>

            <div className={`mono ${styles.groupLabel}`}>02 · TERMEN LIMITĂ</div>
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
                  <div className={`mono ${styles.deadlineName}`}>{opt.name}</div>
                  <div className={`mono ${styles.deadlineNote}`}>{opt.note}</div>
                </button>
              ))}
            </div>

            <div className={`mono ${styles.groupLabel}`}>
              03 · OPȚIUNI SUPLIMENTARE
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
                  {opt.label}
                </button>
              ))}
            </div>

            <div className={styles.total}>
              <div className={`mono ${styles.totalLabel}`}>
                PREȚ ORIENTATIV ESTIMAT
              </div>
              <div className={`disp ${styles.totalValue}`}>
                {priceOf(project)}
              </div>
              <div className={`mono ${styles.totalNote}`}>
                ESTIMARE AUTOMATĂ · PREȚUL FINAL DUPĂ DISCUȚIE.
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
                <h3 className={`disp ${styles.sentTitle}`}>Mulțumim!</h3>
                <p className={styles.sentText}>
                  Am primit cererea pentru {selectedProjectName}. Revenim în
                  curând cu o ofertă.
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className={`mono ${styles.resetBtn}`}
                >
                  TRIMITE ALTĂ CERERE
                </button>
              </div>
            ) : (
              <>
                <h3 className={`disp ${styles.formTitle}`}>Trimite detaliile</h3>
                <p className={styles.formSub}>
                  Revenim cu o ofertă personalizată în cel mult 24h.
                </p>
                <form onSubmit={onSubmit} className={styles.fields} noValidate>
                  <div className={styles.fieldWrap}>
                    <input
                      required
                      value={name}
                      maxLength={LIMITS.name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => touch("name")}
                      placeholder="Nume și prenume"
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
                      placeholder="Email"
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
                      placeholder="Telefon (opțional)"
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
                      placeholder="Spune-ne despre proiectul tău..."
                      aria-invalid={!!showErr("message", messageErr)}
                      className={`mono ${styles.textarea}`}
                      disabled={submitting}
                    />
                    {showErr("message", messageErr) && (
                      <span className={`mono ${styles.fieldError}`}>{messageErr}</span>
                    )}
                  </div>
                  <div className={`mono ${styles.estimateNote}`}>
                    ESTIMARE ATAȘATĂ:{" "}
                    <span className={styles.estimateVal}>{priceOf(project)}</span>{" "}
                    · {selectedProjectName}
                  </div>
                  {formError && (
                    <div className={`mono ${styles.formError}`}>{formError}</div>
                  )}
                  <button
                    type="submit"
                    className={`mono ${styles.submit}`}
                    disabled={submitting || (attempted && formInvalid)}
                  >
                    {submitting ? "Se trimite…" : "Trimite cererea ↗"}
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
