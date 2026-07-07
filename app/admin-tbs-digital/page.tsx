"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PRICE_PLACEHOLDER, type ContactType } from "@/lib/content";
import {
  defaultSiteData,
  loadSiteData,
  saveSiteData,
  clearSiteData,
  type SiteData,
} from "@/lib/siteContent";
import styles from "./admin.module.css";

/**
 * Client-side admin panel (UI-only phase). Edits are persisted to localStorage
 * via the shared site-content store and show live on the homepage. Every list
 * (services, stats, team, partners, contacts) can be added to or removed from.
 * There is no backend — the PIN gate is a light client-side guard, not real
 * auth. A future FastAPI backend replaces both the storage and the auth.
 */
const ADMIN_PIN = "tbs2026";

const genId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const [draft, setDraft] = useState<SiteData>(defaultSiteData);
  const [saved, setSaved] = useState(false);

  // load any existing overrides once mounted (localStorage is client-only)
  useEffect(() => {
    setDraft(loadSiteData());
  }, []);

  const onUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (pin.trim() === ADMIN_PIN) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
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
  const setPartner = (i: number, val: string) =>
    setDraft((d) => ({
      ...d,
      partners: d.partners.map((p, idx) => (idx === i ? val : p)),
    }));
  const addPartner = () =>
    setDraft((d) => ({ ...d, partners: [...d.partners, ""] }));
  const removePartner = (i: number) =>
    setDraft((d) => ({ ...d, partners: d.partners.filter((_, idx) => idx !== i) }));

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

  const onSave = () => {
    saveSiteData(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };
  const onReset = () => {
    clearSiteData();
    setDraft(defaultSiteData);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  if (!unlocked) {
    return (
      <main className={styles.gate}>
        <form onSubmit={onUnlock} className={styles.gateBox}>
          <div className={`mono ${styles.gateLabel}`}>◆ TBS_DIGITAL · ADMIN</div>
          <h1 className={`disp ${styles.gateTitle}`}>Acces restricționat</h1>
          <p className={styles.gateText}>Introdu codul PIN pentru a continua.</p>
          <input
            autoFocus
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className={`mono ${styles.gateInput}`}
          />
          {pinError && (
            <div className={`mono ${styles.gateError}`}>PIN incorect.</div>
          )}
          <button type="submit" className={`mono ${styles.gateBtn}`}>
            Deblochează ↗
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

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <div className={`mono ${styles.kicker}`}>◆ PANOU DE ADMINISTRARE</div>
          <h1 className={`disp ${styles.title}`}>Editează conținutul site-ului</h1>
          <p className={styles.sub}>
            Adaugă, editează sau șterge orice element. Modificările se salvează
            local și apar imediat pe site. (Fără backend în această etapă.)
          </p>
        </div>
        <Link href="/" className={`mono ${styles.viewSite}`}>
          Vezi site-ul ↗
        </Link>
      </header>

      <div className={styles.sections}>
        {/* ---------- services & prices (single source for /03 + estimator) ---------- */}
        <section className={styles.panel}>
          <h2 className={`mono ${styles.panelTitle}`}>01 · SERVICII & PREȚURI</h2>
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
                </label>
                <label className={styles.field}>
                  <span className={`mono ${styles.fieldLabel}`}>Preț (estimator)</span>
                  <input
                    value={s.price}
                    onChange={(e) => setService(i, "price", e.target.value)}
                    placeholder="ex. €500"
                    className={`mono ${styles.input}`}
                  />
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
                  </label>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addService} className={`mono ${styles.addBtn}`}>
            + Adaugă serviciu
          </button>
        </section>

        {/* ---------- stats ---------- */}
        <section className={styles.panel}>
          <h2 className={`mono ${styles.panelTitle}`}>02 · STATISTICI (/02)</h2>
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
                </label>
                <label className={styles.field}>
                  <span className={`mono ${styles.fieldLabel}`}>Etichetă</span>
                  <input
                    value={s.label}
                    onChange={(e) => setStat(i, "label", e.target.value)}
                    placeholder="ex. PROIECTE LIVRATE"
                    className={`mono ${styles.input}`}
                  />
                </label>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStat} className={`mono ${styles.addBtn}`}>
            + Adaugă statistică
          </button>
        </section>

        {/* ---------- team ---------- */}
        <section className={styles.panel}>
          <h2 className={`mono ${styles.panelTitle}`}>03 · ECHIPĂ (/05)</h2>
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
                </label>
                <label className={styles.field}>
                  <span className={`mono ${styles.fieldLabel}`}>Rol</span>
                  <input
                    value={m.role}
                    onChange={(e) => setTeam(i, "role", e.target.value)}
                    placeholder="ex. Full-stack Developer"
                    className={`mono ${styles.input}`}
                  />
                </label>
                <label className={styles.field}>
                  <span className={`mono ${styles.fieldLabel}`}>Bio</span>
                  <textarea
                    rows={2}
                    value={m.bio}
                    onChange={(e) => setTeam(i, "bio", e.target.value)}
                    className={styles.textarea}
                  />
                </label>
              </div>
            ))}
          </div>
          <button type="button" onClick={addTeam} className={`mono ${styles.addBtn}`}>
            + Adaugă membru
          </button>
        </section>

        {/* ---------- partners ---------- */}
        <section className={styles.panel}>
          <h2 className={`mono ${styles.panelTitle}`}>04 · PARTENERI</h2>
          <div className={styles.grid2}>
            {draft.partners.map((p, i) => (
              <div key={i} className={styles.rowCard}>
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
                    value={p}
                    onChange={(e) => setPartner(i, e.target.value)}
                    className={`mono ${styles.input}`}
                  />
                </label>
              </div>
            ))}
          </div>
          <button type="button" onClick={addPartner} className={`mono ${styles.addBtn}`}>
            + Adaugă partener
          </button>
        </section>

        {/* ---------- contacts ---------- */}
        <section className={styles.panel}>
          <h2 className={`mono ${styles.panelTitle}`}>05 · CONTACT</h2>
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
                </label>
              </div>
            ))}
          </div>
          <button type="button" onClick={addContact} className={`mono ${styles.addBtn}`}>
            + Adaugă contact
          </button>
        </section>
      </div>

      {/* sticky action bar */}
      <div className={styles.actions}>
        {saved && <span className={`mono ${styles.savedFlash}`}>Salvat ✓</span>}
        <button
          type="button"
          onClick={onReset}
          className={`mono ${styles.resetBtn}`}
        >
          Resetează la implicit
        </button>
        <button type="button" onClick={onSave} className={`mono ${styles.saveBtn}`}>
          Salvează modificările
        </button>
      </div>
    </main>
  );
}
