"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PRICE_PLACEHOLDER, type ContactType } from "@/lib/content";
import {
  defaultSiteData,
  loadSiteData,
  saveSiteData,
  mergeSiteData,
  type SiteData,
} from "@/lib/siteContent";
import {
  login as apiLogin,
  fetchMe,
  fetchContent,
  saveContent,
  fetchSubmissions,
  uploadLogo,
  mediaUrl,
  getToken,
  setToken,
  clearToken,
  isUnauthorized,
  isNetworkError,
  type ContactSubmissionRecord,
} from "@/lib/api";
import {
  LIMITS,
  validateText,
  sanitizeText,
  sanitizeLink,
  type TextRules,
} from "@/lib/validation";
import styles from "./admin.module.css";

/**
 * Admin panel backed by the FastAPI backend. Access is guarded by a real login
 * (`POST /api/auth/login`) whose bearer token is stored in localStorage and
 * validated on load via `GET /api/auth/me`. The editor loads content from
 * `GET /api/content` and Save writes it back with `PUT /api/content`. A local
 * cache is kept as an offline fallback. Every list (services, stats, team,
 * partners, contacts) can be added to or removed from.
 *
 * The UI is organised into tabs: "Cereri" (read-only contact submissions, shown
 * first) then one tab per editable list. Every editable field is validated
 * client-side (max length + injection blocking) before Save is allowed.
 */

/** Auth lifecycle: validating a stored token, logged out, or logged in. */
type AuthState = "checking" | "unauthenticated" | "authenticated";

/** The editor tabs, in display order — "cereri" is first (default). */
type TabId = "cereri" | "services" | "stats" | "team" | "partners" | "contact";

const genId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

/** Per-field validation rules for the editable content fields. */
const RULES = {
  serviceName: { label: "Numele serviciului", max: LIMITS.short },
  servicePrice: { label: "Prețul", max: 60 },
  serviceDesc: { label: "Descrierea", max: LIMITS.long },
  statValue: { label: "Valoarea", max: 60 },
  statLabel: { label: "Eticheta", max: LIMITS.short },
  teamName: { label: "Numele", max: LIMITS.name },
  teamRole: { label: "Rolul", max: LIMITS.short },
  teamBio: { label: "Bio", max: LIMITS.long },
  partner: { label: "Numele partenerului", max: LIMITS.short },
  partnerUrl: { label: "Site-ul partenerului", max: LIMITS.link, link: true },
  partnerLogo: { label: "Logo-ul", max: LIMITS.link, link: true },
} satisfies Record<string, TextRules>;

/** Validation rules for a contact value, which depend on its type. */
const contactRules = (type: ContactType): TextRules =>
  type === "email"
    ? { label: "Emailul", max: LIMITS.email, email: true }
    : type === "phone"
      ? { label: "Telefonul", max: LIMITS.phone, phone: true }
      : { label: "Valoarea", max: LIMITS.short };

/** Strip HTML/script and trim every free-text field before persisting. */
function sanitizeDraft(d: SiteData): SiteData {
  return {
    stats: d.stats.map((s) => ({
      ...s,
      value: sanitizeText(s.value),
      label: sanitizeText(s.label),
    })),
    services: d.services.map((s) => ({
      ...s,
      name: sanitizeText(s.name),
      desc: sanitizeText(s.desc),
      price: sanitizeText(s.price) || PRICE_PLACEHOLDER,
    })),
    team: d.team.map((m) => ({
      ...m,
      name: sanitizeText(m.name),
      role: sanitizeText(m.role),
      bio: sanitizeText(m.bio),
    })),
    partners: d.partners.map((p) => ({
      ...p,
      name: sanitizeText(p.name),
      // Links are dropped rather than rewritten — see sanitizeLink.
      logo: sanitizeLink(p.logo),
      url: sanitizeLink(p.url),
    })),
    contacts: d.contacts.map((c) => ({ ...c, value: sanitizeText(c.value) })),
  };
}

/** True when any editable field currently fails validation. */
function draftHasErrors(d: SiteData): boolean {
  return (
    d.services.some(
      (s) =>
        !!validateText(s.name, RULES.serviceName) ||
        !!validateText(s.price, RULES.servicePrice) ||
        (!s.estimatorOnly && !!validateText(s.desc, RULES.serviceDesc)),
    ) ||
    d.stats.some(
      (s) =>
        !!validateText(s.value, RULES.statValue) ||
        !!validateText(s.label, RULES.statLabel),
    ) ||
    d.team.some(
      (m) =>
        !!validateText(m.name, RULES.teamName) ||
        !!validateText(m.role, RULES.teamRole) ||
        !!validateText(m.bio, RULES.teamBio),
    ) ||
    d.partners.some(
      (p) =>
        !!validateText(p.name, RULES.partner) ||
        !!validateText(p.url, RULES.partnerUrl) ||
        !!validateText(p.logo, RULES.partnerLogo),
    ) ||
    d.contacts.some((c) => !!validateText(c.value, contactRules(c.type)))
  );
}

/** Inline error label shown under an invalid field. */
function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <span className={`mono ${styles.fieldError}`}>{msg}</span>;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "cereri", label: "Cereri" },
  { id: "services", label: "Servicii & prețuri" },
  { id: "stats", label: "Statistici" },
  { id: "team", label: "Echipă" },
  { id: "partners", label: "Parteneri" },
  { id: "contact", label: "Contact" },
];

export default function AdminPage() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<TabId>("cereri");

  const [draft, setDraft] = useState<SiteData>(defaultSiteData);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Logo upload (Parteneri tab): index of the partner currently uploading, if any.
  const [logoUploading, setLogoUploading] = useState<number | null>(null);
  const [logoError, setLogoError] = useState("");

  // Contact submissions (Cereri tab).
  const [submissions, setSubmissions] = useState<ContactSubmissionRecord[] | null>(
    null,
  );
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState("");

  // Validate any stored token on mount; show the login form if it's missing/invalid.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      // Intentional post-mount setState: the server + first paint render "checking"
      // (localStorage is client-only), then we resolve auth here. SSR-safe by design.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAuth("unauthenticated");
      return;
    }
    let cancelled = false;
    fetchMe(token)
      .then(() => {
        if (!cancelled) setAuth("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        setAuth("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Once authenticated, load the current content from the API (cache as fallback).
  useEffect(() => {
    if (auth !== "authenticated") return;
    let cancelled = false;
    fetchContent()
      .then((remote) => {
        if (!cancelled) setDraft(mergeSiteData(remote));
      })
      .catch(() => {
        if (!cancelled) setDraft(loadSiteData());
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Load contact submissions for the Cereri tab.
  const loadSubmissions = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setAuth("unauthenticated");
      return;
    }
    setSubsError("");
    setSubsLoading(true);
    try {
      const rows = await fetchSubmissions(token);
      setSubmissions(rows);
    } catch (err) {
      if (isUnauthorized(err)) {
        clearToken();
        setAuth("unauthenticated");
        return;
      }
      setSubsError(
        isNetworkError(err)
          ? "Serverul nu răspunde. Încearcă din nou."
          : "Nu s-au putut încărca cererile.",
      );
    } finally {
      setSubsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth !== "authenticated") return;
    // Fetches submissions (which setState internally) once authenticated — a data
    // sync with the backend, run only after auth resolves. Intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSubmissions();
  }, [auth, loadSubmissions]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const token = await apiLogin(username.trim(), password);
      setToken(token);
      setPassword("");
      setAuth("authenticated");
    } catch (err) {
      setLoginError(
        isNetworkError(err)
          ? "Serverul nu răspunde. Încearcă din nou."
          : "Utilizator sau parolă incorecte.",
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const onLogout = () => {
    clearToken();
    setUsername("");
    setPassword("");
    setSubmissions(null);
    setAuth("unauthenticated");
  };

  // ---- services -------------------------------------------------------------
  const setService = (i: number, field: "name" | "desc" | "price", val: string) =>
    setDraft((d) => ({
      ...d,
      services: d.services.map((s, idx) =>
        idx === i ? { ...s, [field]: val } : s,
      ),
    }));
  const addService = () =>
    setDraft((d) => ({
      ...d,
      services: [
        ...d.services,
        { id: genId("svc"), name: "", desc: "", price: PRICE_PLACEHOLDER },
      ],
    }));
  const removeService = (i: number) =>
    setDraft((d) => ({ ...d, services: d.services.filter((_, idx) => idx !== i) }));

  // ---- stats ----------------------------------------------------------------
  const setStat = (i: number, field: "value" | "label", val: string) =>
    setDraft((d) => ({
      ...d,
      stats: d.stats.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)),
    }));
  const addStat = () =>
    setDraft((d) => ({
      ...d,
      stats: [...d.stats, { id: genId("stat"), value: "", label: "" }],
    }));
  const removeStat = (i: number) =>
    setDraft((d) => ({ ...d, stats: d.stats.filter((_, idx) => idx !== i) }));

  // ---- team -----------------------------------------------------------------
  const setTeam = (i: number, field: "name" | "role" | "bio", val: string) =>
    setDraft((d) => ({
      ...d,
      team: d.team.map((m, idx) => (idx === i ? { ...m, [field]: val } : m)),
    }));
  const addTeam = () =>
    setDraft((d) => ({
      ...d,
      team: [...d.team, { id: genId("team"), name: "", role: "", bio: "" }],
    }));
  const removeTeam = (i: number) =>
    setDraft((d) => ({ ...d, team: d.team.filter((_, idx) => idx !== i) }));

  // ---- partners -------------------------------------------------------------
  const setPartner = (i: number, field: "name" | "logo" | "url", val: string) =>
    setDraft((d) => ({
      ...d,
      partners: d.partners.map((p, idx) =>
        idx === i ? { ...p, [field]: val } : p,
      ),
    }));
  const addPartner = () =>
    setDraft((d) => ({
      ...d,
      partners: [
        ...d.partners,
        { id: genId("p"), name: "", logo: "", url: "" },
      ],
    }));
  const removePartner = (i: number) =>
    setDraft((d) => ({ ...d, partners: d.partners.filter((_, idx) => idx !== i) }));

  /**
   * Upload a logo and point the partner at the stored path. The file itself is
   * saved immediately (it is content-addressed by a uuid, so an abandoned upload
   * is just an orphan file); the partner row only persists on Save like every
   * other field.
   */
  const onLogoPicked = async (i: number, file: File) => {
    const token = getToken();
    if (!token) {
      setAuth("unauthenticated");
      return;
    }
    setLogoUploading(i);
    setLogoError("");
    try {
      const url = await uploadLogo(file, token);
      setPartner(i, "logo", url);
    } catch (err) {
      if (isUnauthorized(err)) {
        clearToken();
        setAuth("unauthenticated");
        return;
      }
      setLogoError(
        isNetworkError(err)
          ? "Serverul nu răspunde — logo-ul nu a fost încărcat."
          : err instanceof Error
            ? err.message
            : "Încărcarea logo-ului a eșuat.",
      );
    } finally {
      setLogoUploading(null);
    }
  };

  // ---- contacts -------------------------------------------------------------
  const setContact = (i: number, field: "type" | "value", val: string) =>
    setDraft((d) => ({
      ...d,
      contacts: d.contacts.map((c, idx) =>
        idx === i ? { ...c, [field]: val } : c,
      ),
    }));
  const addContact = () =>
    setDraft((d) => ({
      ...d,
      contacts: [...d.contacts, { id: genId("c"), type: "email", value: "" }],
    }));
  const removeContact = (i: number) =>
    setDraft((d) => ({ ...d, contacts: d.contacts.filter((_, idx) => idx !== i) }));

  const hasErrors = draftHasErrors(draft);

  const onSave = async () => {
    if (hasErrors) return; // guard against forced clicks
    const token = getToken();
    if (!token) {
      setAuth("unauthenticated");
      return;
    }
    const clean = sanitizeDraft(draft);
    setSaveError("");
    setSaving(true);
    try {
      await saveContent(clean, token);
      setDraft(clean); // reflect the sanitized values in the editor
      saveSiteData(clean); // refresh the offline cache
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      if (isUnauthorized(err)) {
        // Token expired/invalid — send the admin back to the login form.
        clearToken();
        setAuth("unauthenticated");
        return;
      }
      setSaveError(
        isNetworkError(err)
          ? "Serverul nu răspunde — modificările nu au fost salvate."
          : "Salvarea a eșuat. Încearcă din nou.",
      );
    } finally {
      setSaving(false);
    }
  };
  // Reset only the editor draft to defaults; the admin must Save to persist it.
  const onReset = () => {
    setDraft(defaultSiteData);
    setSaveError("");
  };

  if (auth === "checking") {
    return (
      <main className={`mono ${styles.checking}`}>Se verifică accesul…</main>
    );
  }

  if (auth === "unauthenticated") {
    return (
      <main className={styles.gate}>
        <form onSubmit={onLogin} className={styles.gateBox}>
          <div className={`mono ${styles.gateLabel}`}>◆ TBS_DIGITAL · ADMIN</div>
          <h1 className={`disp ${styles.gateTitle}`}>Acces restricționat</h1>
          <p className={styles.gateText}>
            Autentifică-te pentru a edita conținutul site-ului.
          </p>
          <input
            autoFocus
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Utilizator"
            className={`mono ${styles.loginInput}`}
            disabled={loggingIn}
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parolă"
            className={`mono ${styles.loginInput}`}
            disabled={loggingIn}
          />
          {loginError && (
            <div className={`mono ${styles.gateError}`}>{loginError}</div>
          )}
          <button
            type="submit"
            className={`mono ${styles.gateBtn}`}
            disabled={loggingIn}
          >
            {loggingIn ? "Se autentifică…" : "Autentifică-te ↗"}
          </button>
          <Link href="/" className={`mono ${styles.gateBack}`}>
            ← Înapoi la site
          </Link>
        </form>
      </main>
    );
  }

  // grid numbers for the /03 cards (estimator-only entries don't get one)
  let gridNo = 0;
  const svcLabels = draft.services.map((s) =>
    s.estimatorOnly ? "Doar în estimator" : `/${String(++gridNo).padStart(2, "0")}`,
  );

  const submissionCount = submissions?.length ?? 0;
  const isEditing = tab !== "cereri";

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <div className={`mono ${styles.kicker}`}>◆ PANOU DE ADMINISTRARE</div>
          <h1 className={`disp ${styles.title}`}>Editează conținutul site-ului</h1>
          <p className={styles.sub}>
            Adaugă, editează sau șterge orice element. Modificările se salvează
            pe server și apar pe site pentru toți vizitatorii.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" className={`mono ${styles.viewSite}`}>
            Vezi site-ul ↗
          </Link>
          <button type="button" onClick={onLogout} className={`mono ${styles.logout}`}>
            Deconectare
          </button>
        </div>
      </header>

      {/* ---------- tab bar ---------- */}
      <nav className={styles.tabBar} aria-label="Secțiuni admin">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`mono ${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
            {t.id === "cereri" && submissionCount > 0 && (
              <span className={`mono ${styles.tabBadge}`}>{submissionCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className={styles.sections}>
        {/* ---------- Cereri (submissions) — read-only ---------- */}
        {tab === "cereri" && (
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={`mono ${styles.panelTitle}`}>CERERI PRIMITE</h2>
                <p className={styles.panelHint}>
                  Cererile trimise prin formularul de contact, cele mai noi
                  primele.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadSubmissions()}
                disabled={subsLoading}
                className={`mono ${styles.refreshBtn}`}
              >
                {subsLoading ? "Se încarcă…" : "↻ Reîmprospătează"}
              </button>
            </div>

            {subsError && (
              <div className={`mono ${styles.gateError}`}>{subsError}</div>
            )}

            {subsLoading && submissions === null ? (
              <p className={`mono ${styles.subsEmpty}`}>Se încarcă cererile…</p>
            ) : submissionCount === 0 && !subsError ? (
              <p className={`mono ${styles.subsEmpty}`}>Nicio cerere încă.</p>
            ) : (
              <div className={styles.subsList}>
                {submissions?.map((s) => (
                  <article key={s.id} className={styles.subCard}>
                    <div className={styles.subHead}>
                      <span className={styles.subName}>{s.name}</span>
                      <time className={`mono ${styles.subTime}`}>
                        {formatDate(s.created_at)}
                      </time>
                    </div>
                    <div className={styles.subMeta}>
                      <a href={`mailto:${s.email}`} className={`mono ${styles.subLink}`}>
                        {s.email}
                      </a>
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className={`mono ${styles.subLink}`}>
                          {s.phone}
                        </a>
                      )}
                    </div>
                    {(s.project || s.estimate) && (
                      <div className={`mono ${styles.subEstimate}`}>
                        {s.project && <span>{s.project}</span>}
                        {s.estimate && (
                          <span className={styles.subEstimateVal}>{s.estimate}</span>
                        )}
                      </div>
                    )}
                    {s.message && <p className={styles.subMessage}>{s.message}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---------- services & prices (single source for /03 + estimator) ---------- */}
        {tab === "services" && (
          <section className={styles.panel}>
            <h2 className={`mono ${styles.panelTitle}`}>SERVICII & PREȚURI</h2>
            <p className={styles.panelHint}>
              Numele și prețul apar atât pe cardurile din /03, cât și în estimator —
              editează o singură dată. Prețul apare în estimator; lasă „...” pentru
              necunoscut.
            </p>
            <div className={styles.grid2}>
              {draft.services.map((s, i) => (
                <div key={s.id} className={styles.rowCard}>
                  <div className={styles.rowHead}>
                    <span className={`mono ${styles.rowTag}`}>{svcLabels[i]}</span>
                    <button
                      type="button"
                      onClick={() => removeService(i)}
                      className={styles.removeBtn}
                      aria-label="Șterge serviciul"
                    >
                      ✕
                    </button>
                  </div>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Nume</span>
                    <input
                      value={s.name}
                      onChange={(e) => setService(i, "name", e.target.value)}
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(s.name, RULES.serviceName)} />
                  </label>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Preț (estimator)</span>
                    <input
                      value={s.price}
                      onChange={(e) => setService(i, "price", e.target.value)}
                      placeholder="ex. €500"
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(s.price, RULES.servicePrice)} />
                  </label>
                  {!s.estimatorOnly && (
                    <label className={styles.field}>
                      <span className={`mono ${styles.fieldLabel}`}>
                        Descriere (card /03)
                      </span>
                      <textarea
                        rows={2}
                        value={s.desc}
                        onChange={(e) => setService(i, "desc", e.target.value)}
                        className={styles.textarea}
                      />
                      <FieldError msg={validateText(s.desc, RULES.serviceDesc)} />
                    </label>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addService} className={`mono ${styles.addBtn}`}>
              + Adaugă serviciu
            </button>
          </section>
        )}

        {/* ---------- stats ---------- */}
        {tab === "stats" && (
          <section className={styles.panel}>
            <h2 className={`mono ${styles.panelTitle}`}>STATISTICI (/02)</h2>
            <p className={styles.panelHint}>
              Lasă gol pentru a păstra o casetă ca placeholder.
            </p>
            <div className={styles.grid2}>
              {draft.stats.map((s, i) => (
                <div key={s.id} className={styles.rowCard}>
                  <div className={styles.rowHead}>
                    <span className={`mono ${styles.rowTag}`}>Statistică {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeStat(i)}
                      className={styles.removeBtn}
                      aria-label="Șterge statistica"
                    >
                      ✕
                    </button>
                  </div>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Valoare</span>
                    <input
                      value={s.value}
                      onChange={(e) => setStat(i, "value", e.target.value)}
                      placeholder="ex. 50+"
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(s.value, RULES.statValue)} />
                  </label>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Etichetă</span>
                    <input
                      value={s.label}
                      onChange={(e) => setStat(i, "label", e.target.value)}
                      placeholder="ex. PROIECTE LIVRATE"
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(s.label, RULES.statLabel)} />
                  </label>
                </div>
              ))}
            </div>
            <button type="button" onClick={addStat} className={`mono ${styles.addBtn}`}>
              + Adaugă statistică
            </button>
          </section>
        )}

        {/* ---------- team ---------- */}
        {tab === "team" && (
          <section className={styles.panel}>
            <h2 className={`mono ${styles.panelTitle}`}>ECHIPĂ (/05)</h2>
            <p className={styles.panelHint}>
              Lasă gol pentru a păstra o casetă ca placeholder.
            </p>
            <div className={styles.grid2}>
              {draft.team.map((m, i) => (
                <div key={m.id} className={styles.rowCard}>
                  <div className={styles.rowHead}>
                    <span className={`mono ${styles.rowTag}`}>Membru {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTeam(i)}
                      className={styles.removeBtn}
                      aria-label="Șterge membrul"
                    >
                      ✕
                    </button>
                  </div>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Nume</span>
                    <input
                      value={m.name}
                      onChange={(e) => setTeam(i, "name", e.target.value)}
                      placeholder="ex. Ion Popescu"
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(m.name, RULES.teamName)} />
                  </label>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Rol</span>
                    <input
                      value={m.role}
                      onChange={(e) => setTeam(i, "role", e.target.value)}
                      placeholder="ex. Full-stack Developer"
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(m.role, RULES.teamRole)} />
                  </label>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Bio</span>
                    <textarea
                      rows={2}
                      value={m.bio}
                      onChange={(e) => setTeam(i, "bio", e.target.value)}
                      className={styles.textarea}
                    />
                    <FieldError msg={validateText(m.bio, RULES.teamBio)} />
                  </label>
                </div>
              ))}
            </div>
            <button type="button" onClick={addTeam} className={`mono ${styles.addBtn}`}>
              + Adaugă membru
            </button>
          </section>
        )}

        {/* ---------- partners ---------- */}
        {tab === "partners" && (
          <section className={styles.panel}>
            <h2 className={`mono ${styles.panelTitle}`}>PARTENERI</h2>
            <p className={styles.panelHint}>
              Logo-ul apare în secțiunea „Partenerii noștri” și trimite către
              site-ul partenerului. Încarcă un PNG, JPG sau WebP de max 512 KB —
              ideal alb, pe fundal transparent (site-ul are fundal închis).
            </p>
            {logoError && (
              <p className={`mono ${styles.fieldError}`}>{logoError}</p>
            )}
            <div className={styles.grid2}>
              {draft.partners.map((p, i) => (
                <div key={p.id} className={styles.rowCard}>
                  <div className={styles.rowHead}>
                    <span className={`mono ${styles.rowTag}`}>Partener {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removePartner(i)}
                      className={styles.removeBtn}
                      aria-label="Șterge partenerul"
                    >
                      ✕
                    </button>
                  </div>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Nume</span>
                    <input
                      value={p.name}
                      onChange={(e) => setPartner(i, "name", e.target.value)}
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(p.name, RULES.partner)} />
                  </label>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Site</span>
                    <input
                      value={p.url}
                      onChange={(e) => setPartner(i, "url", e.target.value)}
                      placeholder="https://exemplu.md"
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(p.url, RULES.partnerUrl)} />
                  </label>
                  <div className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Logo</span>
                    <div className={styles.logoRow}>
                      {p.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(p.logo)}
                          alt={p.name || "Logo partener"}
                          className={styles.logoPreview}
                        />
                      ) : (
                        <span className={`mono ${styles.logoEmpty}`}>
                          fără logo
                        </span>
                      )}
                      <div className={styles.logoActions}>
                        <label className={`mono ${styles.uploadBtn}`}>
                          {logoUploading === i ? "Se încarcă…" : "Încarcă logo"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={logoUploading !== null}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              // Reset the input so re-picking the same file fires onChange again.
                              e.target.value = "";
                              if (file) void onLogoPicked(i, file);
                            }}
                            className={styles.fileInput}
                          />
                        </label>
                        {p.logo && (
                          <button
                            type="button"
                            onClick={() => setPartner(i, "logo", "")}
                            className={`mono ${styles.linkBtn}`}
                          >
                            Elimină
                          </button>
                        )}
                      </div>
                    </div>
                    <FieldError msg={validateText(p.logo, RULES.partnerLogo)} />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addPartner} className={`mono ${styles.addBtn}`}>
              + Adaugă partener
            </button>
          </section>
        )}

        {/* ---------- contacts ---------- */}
        {tab === "contact" && (
          <section className={styles.panel}>
            <h2 className={`mono ${styles.panelTitle}`}>CONTACT</h2>
            <p className={styles.panelHint}>
              „Email” devine link mailto, „Telefon” devine link tel, „Altul” apare
              ca text simplu.
            </p>
            <div className={styles.grid2}>
              {draft.contacts.map((c, i) => (
                <div key={c.id} className={styles.rowCard}>
                  <div className={styles.rowHead}>
                    <span className={`mono ${styles.rowTag}`}>Contact {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeContact(i)}
                      className={styles.removeBtn}
                      aria-label="Șterge contactul"
                    >
                      ✕
                    </button>
                  </div>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Tip</span>
                    <select
                      value={c.type}
                      onChange={(e) =>
                        setContact(i, "type", e.target.value as ContactType)
                      }
                      className={`mono ${styles.input}`}
                    >
                      <option value="email">Email</option>
                      <option value="phone">Telefon</option>
                      <option value="other">Altul</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span className={`mono ${styles.fieldLabel}`}>Valoare</span>
                    <input
                      value={c.value}
                      onChange={(e) => setContact(i, "value", e.target.value)}
                      placeholder={
                        c.type === "email"
                          ? "ex. contact@tbsdigital.ro"
                          : c.type === "phone"
                            ? "ex. +373 600 00 000"
                            : "ex. Chișinău, MD"
                      }
                      className={`mono ${styles.input}`}
                    />
                    <FieldError msg={validateText(c.value, contactRules(c.type))} />
                  </label>
                </div>
              ))}
            </div>
            <button type="button" onClick={addContact} className={`mono ${styles.addBtn}`}>
              + Adaugă contact
            </button>
          </section>
        )}
      </div>

      {/* sticky action bar — hidden on the read-only Cereri tab */}
      {isEditing && (
        <div className={styles.actions}>
          {saved && <span className={`mono ${styles.savedFlash}`}>Salvat ✓</span>}
          {hasErrors && (
            <span className={`mono ${styles.gateError}`}>
              Corectează câmpurile marcate înainte de salvare.
            </span>
          )}
          {saveError && (
            <span className={`mono ${styles.gateError}`}>{saveError}</span>
          )}
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className={`mono ${styles.resetBtn}`}
          >
            Resetează la implicit
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || hasErrors}
            className={`mono ${styles.saveBtn}`}
          >
            {saving ? "Se salvează…" : "Salvează modificările"}
          </button>
        </div>
      )}
    </main>
  );
}

/** Format an ISO timestamp for display; fall back to the raw string. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
