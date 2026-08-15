<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Record every change

`CHANGELOG.md` is this project's change zone. **Finishing a change means logging it there**,
in the same commit — not later, not "if it's big enough".

1. Add an entry at the top of `CHANGELOG.md` under today's date: what changed, why, the
   files/areas touched, and the category (`Added` · `Changed` · `Fixed` · `Security` ·
   `Docs` · `Deploy` · `Removed`).
2. If the change alters how the app behaves or is operated, **update the matching doc in
   `docs/`** and link it from the entry. The changelog is the index; `docs/` is the
   explanation. A behaviour change with no doc update is an unfinished change.
3. Keep `README.md`'s doc table in sync when a doc is added or renamed.

Before writing code, read the docs that cover the area you're touching (`docs/03` for
structure, `docs/07` for conventions, `docs/11` + `SECURITY.md` for anything security-facing,
`docs/16` for copy/i18n/SEO). New user-visible copy is **never hardcoded** — it is a message
catalog key or a `{ ro, ru, en }` content field (see `docs/16-i18n-seo.md`).

## Verifying

The stack runs in **Docker** (`make up`); backend tests run with `make test` inside the
container. Frontend checks: `npm test`, `npm run lint`, `npm run build`. Don't install
Python/Node toolchains locally unless asked — use the containers.
