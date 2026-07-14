"use client";

import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { socialIcons, socialNames } from "@/components/ui/SocialIcons";
import { mediaUrl } from "@/lib/api";
import { statusBars, type SocialNetwork } from "@/lib/content";
import { useSiteContent, type TeamItem } from "@/lib/siteContent";
import styles from "./Team.module.css";

/**
 * The member fields that carry a social URL, in the order their icons appear.
 * Only the networks with a non-empty URL get an icon — an empty field is simply
 * no icon, never a dead link, so a member with no links renders no icon row.
 */
const SOCIAL_FIELDS = [
  "website",
  "linkedin",
  "instagram",
  "facebook",
  "github",
] as const satisfies readonly (SocialNetwork & keyof TeamItem)[];

/**
 * Read a member field defensively.
 *
 * `TeamItem` types every field as `string`, but the *wire* is not typed: the API
 * still serves team rows saved before the photo/social fields existed, so those keys
 * come back `undefined`. Reaching straight for `m.linkedin.trim()` takes the whole
 * page down with it, so each field is narrowed at the boundary instead.
 */
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Links a member actually has, ready to render. */
function linksOf(m: TeamItem) {
  return SOCIAL_FIELDS.map((network) => ({
    network,
    url: str(m[network]),
  })).filter((l) => l.url !== "");
}

/** Accessible name for a link: it has to say *whose* profile it opens. */
function socialLabel(network: SocialNetwork, name: string): string {
  return network === "website"
    ? `Site-ul personal al lui ${name}`
    : `${name} pe ${socialNames[network]}`;
}

/**
 * Up to two initials for the gradient avatar. Photos are uploaded from the admin,
 * so most members have none — the initials are what makes that state read as a
 * deliberate monogram rather than an empty box.
 */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Team() {
  const { team } = useSiteContent();

  return (
    <section id="echipa" className="section">
      <div className={`container ${styles.layout}`}>
        {/* left column */}
        <div>
          <Reveal>
            <SectionLabel index="/05">ECHIPA</SectionLabel>
            <h2 className={`disp ${styles.title}`}>
              Oamenii din
              <br />
              spatele codului
            </h2>
            <p className={styles.lead}>
              O echipă mică și dedicată care combină strategia de business cu
              dezvoltarea tehnică.
            </p>
          </Reveal>

          <Reveal className={styles.status}>
            <div className={`mono ${styles.statusLabel}`}>SYSTEM_STATUS</div>
            {statusBars.map((b) => (
              <div key={b.label} className={styles.statusRow}>
                <span className={`mono ${styles.statusName}`}>{b.label}</span>
                <span className={styles.statusTrack}>
                  <span
                    className={styles.statusFill}
                    style={{ width: b.pct }}
                  />
                </span>
                <span className={`mono ${styles.statusVal}`}>{b.val}</span>
              </div>
            ))}
            <div className={`mono hz ${styles.statusStripes}`} />
          </Reveal>
        </div>

        {/* right column: the real team */}
        <div className={styles.cards}>
          {team.map((m) => {
            const name = str(m.name);
            const role = str(m.role);
            const bio = str(m.bio);
            const stored = str(m.photo);
            const photo = stored ? mediaUrl(stored) : "";
            const initials = initialsOf(name);
            const links = linksOf(m);

            return (
              <Reveal key={m.id} className={styles.card}>
                <div className={styles.avatar}>
                  {photo ? (
                    // Plain <img>: photos are admin-uploaded, of arbitrary aspect
                    // ratio, and served from the backend origin — next/image would
                    // need a remotePatterns entry per deploy host to optimise them.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={name}
                      loading="lazy"
                      className={styles.photo}
                    />
                  ) : (
                    // The card already announces the member by name right below.
                    <span className={`disp ${styles.initials}`} aria-hidden="true">
                      {initials}
                    </span>
                  )}
                </div>

                <span className={styles.name}>{name}</span>
                <span className={`mono ${styles.role}`}>{role}</span>
                {bio ? <p className={styles.bio}>{bio}</p> : null}

                {links.length > 0 ? (
                  <div className={styles.socials}>
                    {links.map(({ network, url }) => (
                      <a
                        key={network}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.social}
                        aria-label={socialLabel(network, name)}
                      >
                        {socialIcons[network]}
                      </a>
                    ))}
                  </div>
                ) : null}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
