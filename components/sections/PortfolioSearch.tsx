"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { format } from "@/lib/i18n/format";
import { projectGradient } from "@/lib/projectAccent";
import { searchProjects } from "@/lib/portfolioPages";
import type { ProjectItem } from "@/lib/siteContent";
import s from "./Portfolio.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  label: L("Caută un proiect după nume", "Найти проект по названию", "Find a project by name"),
  clear: L("Șterge căutarea", "Очистить поиск", "Clear the search"),
  list: L("Proiecte găsite", "Найденные проекты", "Projects found"),
  onScreen: L("pe ecran", "на экране", "on screen"),
  more: L(
    "Mai sunt {n} — scrie mai multe litere din nume.",
    "Ещё {n} — допишите название.",
    "{n} more — type more of the name.",
  ),
  none: L(
    "Nu am găsit niciun proiect cu „{q}”. Încearcă alt cuvânt sau alege un serviciu de mai sus.",
    "Проектов с «{q}» нет. Попробуйте другое слово или выберите услугу выше.",
    "No project matches “{q}”. Try another word, or pick a service above.",
  ),
  found: L("{count} găsite.", "Найдено: {count}.", "{count} found."),
  foundOne: L("Un proiect găsit.", "Найден один проект.", "One project found."),
  foundNone: L("Niciun proiect găsit.", "Ничего не найдено.", "No project found."),
};

/** No more names than this in the list at once: the rest wait for more letters. */
const MAX_HITS = 8;
/** What the search found is said once the typing pauses this long. */
const SAY_AFTER_MS = 450;

/**
 * "Caută un proiect după nume" under the pixels of a big portfolio (more projects than one page)
 * and their pages: a field whose list offers the names holding what was typed — capitals and
 * diacritics do not matter, and a word of the kind of work ("magazin") finds the shops — each led
 * by its pad and followed by its kind (or "pe ecran"). Nothing on the page changes until a name is chosen
 * (Enter takes the marked one: the first, until ↑ ↓ mark another — the ARIA combobox's "automatic
 * selection"); choosing puts it on the screen, on its page. Escape closes the list and a second
 * Escape empties the field. The list opens under the field, or over it where the window has more
 * room there — never under the site's header.
 */
export function PortfolioSearch({
  projects,
  currentId,
  count,
  onPick,
  onSay,
  onWarm,
}: {
  projects: readonly ProjectItem[];
  currentId: string;
  /** "{n} proiecte" in the visitor's language. */
  count: (n: number) => string;
  onPick: (project: ProjectItem) => void;
  /** Says a sentence in the page's polite live region (a stable function: a state setter). */
  onSay: (text: string) => void;
  /** Asks for a project's screenshot ahead, so the one marked is there if it is chosen. */
  onWarm: (project: ProjectItem) => void;
}) {
  const l = useLoc();
  const id = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  /* the name marked by ↑ ↓ or the pointer; -1 is "the first" */
  const [active, setActive] = useState(-1);

  const all = searchProjects(projects, query, (p) => l(p.tag));
  const hits = all.slice(0, MAX_HITS);
  const trimmed = query.trim();
  const shown = open && trimmed !== "";
  const marked = shown && hits.length ? Math.min(Math.max(0, active), hits.length - 1) : -1;
  const listId = `${id}-list`;
  const optionId = (k: number) => `${id}-opt-${k}`;

  /* The count, said once the typing pauses — not at every letter (each letter restarts the wait). */
  const sentence = !trimmed
    ? ""
    : all.length === 0
      ? l(COPY.foundNone)
      : all.length === 1
        ? l(COPY.foundOne)
        : format(l(COPY.found), { count: count(all.length) });
  useEffect(() => {
    if (!sentence) return;
    const timer = window.setTimeout(() => onSay(sentence), SAY_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [sentence, trimmed, onSay]);

  /* Under the field, or over it where there is more room — a laptop's short window, a phone's
     keyboard — and never under the sticky header. A measurement, written on the list itself. */
  useLayoutEffect(() => {
    const pop = popRef.current;
    const input = inputRef.current;
    if (!open || !pop || !input) return;
    pop.removeAttribute("data-up");
    pop.style.maxHeight = "";
    const r = input.getBoundingClientRect();
    const vv = window.visualViewport;
    const top = vv ? vv.offsetTop : 0;
    const bottom = top + (vv ? vv.height : window.innerHeight);
    const header = document.querySelector("header");
    const ceiling = Math.max(top, header ? header.getBoundingClientRect().bottom : 0);
    const below = bottom - r.bottom - 14;
    const above = r.top - ceiling - 14;
    const need = Math.min(pop.scrollHeight + 2, 420);
    const up = below < need && above > below;
    if (up) pop.setAttribute("data-up", "");
    pop.style.maxHeight = `${Math.max(132, Math.floor(Math.min(420, up ? above : below)))}px`;
  }, [open, query]);

  /* The marked name stays in view in a short list, and its screenshot is asked for ahead. */
  const markedProject = marked >= 0 ? projects[hits[marked].index] : null;
  useLayoutEffect(() => {
    if (marked < 0) return;
    document.getElementById(`${id}-opt-${marked}`)?.scrollIntoView({ block: "nearest" });
  }, [marked, id]);
  useEffect(() => {
    if (markedProject) onWarm(markedProject);
  }, [markedProject, onWarm]);

  const pick = (project: ProjectItem) => {
    setQuery("");
    setOpen(false);
    setActive(-1);
    onPick(project);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // the page's ← → change the project; inside the field they move the caret
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.stopPropagation();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!trimmed || !hits.length) return;
      event.preventDefault();
      setOpen(true);
      const n = hits.length;
      const from = shown ? marked : -1;
      const down = event.key === "ArrowDown";
      setActive(from < 0 ? (down ? 0 : n - 1) : (from + (down ? 1 : -1) + n) % n);
    } else if (event.key === "Enter") {
      if (!trimmed) return;
      event.preventDefault();
      const hit = hits[Math.max(0, marked)];
      if (hit) pick(projects[hit.index]);
    } else if (event.key === "Escape") {
      if (open && trimmed) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (query) {
        event.preventDefault();
        setQuery("");
      }
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!boxRef.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
      setActive(-1);
    }
  };

  const more = all.length - hits.length;

  return (
    <div ref={boxRef} className={s.find} role="search" onBlur={onBlur}>
      <svg className={s.findIcon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 4.5 4.5" />
      </svg>
      <input
        ref={inputRef}
        className={s.findInput}
        type="search"
        placeholder={l(COPY.label)}
        aria-label={l(COPY.label)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown && hits.length > 0}
        aria-controls={listId}
        aria-activedescendant={marked >= 0 ? optionId(marked) : undefined}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {query ? (
        <button
          type="button"
          className={s.findClear}
          aria-label={l(COPY.clear)}
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
      <div ref={popRef} className={s.findPop} hidden={!shown}>
        {/* a press on a name keeps the focus in the field (and the list open) until the click */}
        <ul
          id={listId}
          className={s.findList}
          role="listbox"
          aria-label={l(COPY.list)}
          hidden={!hits.length}
          onMouseDown={(event) => event.preventDefault()}
        >
          {hits.map((hit, k) => {
            const p = projects[hit.index];
            const [, p2] = projectGradient(p, hit.index);
            return (
              <li
                key={p.id}
                id={optionId(k)}
                role="option"
                aria-selected={k === marked}
                className={s.findOption}
                style={{ "--p2": p2 } as CSSProperties}
                onClick={() => pick(p)}
                onMouseMove={() => {
                  if (k !== marked) setActive(k);
                }}
              >
                <span className={s.findLed} aria-hidden="true" />
                <span className={s.findName}>
                  {hit.start >= 0 ? (
                    <>
                      {p.name.slice(0, hit.start)}
                      <mark>{p.name.slice(hit.start, hit.end)}</mark>
                      {p.name.slice(hit.end)}
                    </>
                  ) : (
                    p.name
                  )}
                </span>
                <span className={`mono ${s.findTag}`} data-on={p.id === currentId ? "" : undefined}>
                  {p.id === currentId ? l(COPY.onScreen) : l(p.tag)}
                </span>
              </li>
            );
          })}
        </ul>
        {all.length === 0 ? (
          <p className={s.findNote}>{format(l(COPY.none), { q: trimmed })}</p>
        ) : more > 0 ? (
          <p className={s.findNote}>{format(l(COPY.more), { n: more })}</p>
        ) : null}
      </div>
    </div>
  );
}
