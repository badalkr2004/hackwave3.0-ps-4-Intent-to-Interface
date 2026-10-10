# Gestalt

**Intent-to-Interface Adaptive Workspace** — a workspace that composes itself around the question a task needs answered.

You type a goal (“Prepare me for Acme tomorrow”). Gestalt parses intent into a *shape* and *scope*, ranks the questions the task must answer, runs a deterministic **component auction**, and streams a UI spec to a closed React panel registry. Shared panels morph in place on pivots. A **Why lens** shows real bid receipts — not post-hoc LLM prose.

Hackathon PS 4 (Human-Centered AI). Non-goals for this build: authentication, multi-tenant SaaS, real Slack/CRM integrations. Those are the next phase (Better Auth + Drizzle on Neon).

---

## Quick start

```bash
bun install
cp .env.example .env   # then fill DATABASE_URL and at least one LLM key
bun run db:migrate
bun run db:seed        # or rely on seed-if-empty on server boot
bun run dev            # API :8787, Vite :5173 (proxies /api)
```

Open [http://localhost:5173](http://localhost:5173).

| Script | Purpose |
|---|---|
| `bun run dev` | Live server + web |
| `bun run demo:offline` | Same with `FORCE_FALLBACK=1` (fixtures only, no LLM) |
| `bun run db:check` | Counts rows in `DB_SCHEMA` (never prints `DATABASE_URL`) |
| `bun run db:migrate` / `db:seed` / `db:reset` | Schema ops (`db:reset` needs `ALLOW_DB_RESET=1`) |
| `bun run llm:smoke` | One tiny structured call per LLM stage |
| `bun run test` / `typecheck` / `lint` | Quality gates |

**Database note:** all tables live in the schema named by `DB_SCHEMA` (default `gestalt`). Neon’s console defaults to `public`, which looks empty — switch schema or run `bun run db:check`.

---

## Architecture

```
┌────────────────────────────┐         ┌──────────────────────────────────────┐
│  apps/web (React + Vite)   │  SSE    │  apps/server (Express + Bun)         │
│  IntentBar · ZoneGrid      │◄───────►│  Intent → Needs → Auction → UISpec   │
│  DiffRibbon · Why lens     │  JSON   │  callStructured (AI SDK + Zod)       │
│  GhostPreviews · Panels    │         │  Registry loaders + digest           │
└────────────────────────────┘         │  Fixture / keyword fallbacks         │
                                       └──────────────────┬───────────────────┘
                                                          │ postgres (tagged SQL)
                                                          ▼
                                                   Neon · schema DB_SCHEMA
                                       packages/shared — Zod contracts, manifests, needs
```

**Hard rules**

1. The LLM never emits UI. It returns small Zod-validated JSON (intent, need plan, copy, email).
2. Layout is deterministic: `score = priority × fit × (0.7 + 0.3 × signal)`.
3. Every LLM call has timeout → one corrective retry → deterministic fallback (`degraded: true`).
4. Aborted or superseded requests never commit a partial spec.

**Compose stream (happy path)**  
`status(parsing)` → `intent` → `status(fetching|planning|composing)` → `spec` → `status(writing)` → `patch*` → `done`

---

## Demo script (judges)

| # | Action | Expect |
|---|---|---|
| 0 | Load app | Overview in &lt;500 ms (no LLM): portfolio, meetings, usage, overdue, issues |
| 1 | *Prepare … Acme* | Prepare layout; talking points skeleton → patch |
| 2 | Press `?` | Why lens: scores, evidence, Left out, prioritization |
| 3 | *Wait, why did their usage drop?* | Pivot: scope kept; shared panels morph; Diff ribbon; Back chip |
| 4 | *Show me everything overdue…* | Triage: overdue L, blockers, workload |
| 5 | *look into Acme* | Ghost previews (Likely / Possible); pick one |
| 6 | Back chip | Instant restore, no LLM |
| 7 | Pin / dismiss | Steer layout; Bring back in Left out |
| 8 | Draft pre-meeting email | Modal grounded in digest facts |

Shortcuts: `/` intent bar · `?` Why lens · `Esc` close lens / cancel ghosts.

Rehearse once live (`bun run dev`) and once offline (`bun run demo:offline`). Record a backup video of the offline path before the event.

---

## One-slide summary

**Problem:** Fixed dashboards make people hunt for data.  
**Insight:** Organize UI around *questions*, not widgets.  
**Mechanism:** LLM proposes meaning; a pure auction decides layout; Why lens shows receipts.  
**Reliability:** Fixtures + keyword fallback; demo never depends on the model.  
**Next:** Better Auth, Drizzle, org-scoped Neon data, real integrations.

---

## Adding a component

No layout code. Touch these five places:

1. **Manifest** — `packages/shared/src/manifests.ts` (id, question, fits, sizes, placement matrix).
2. **Props schema** — `packages/shared/src/panels.ts` and export from the shared index.
3. **Loader + signal** — `apps/server/src/registry/<id>.ts`, register in `registry/index.ts`.
4. **React panel** — `apps/web/src/panels/<Name>/index.tsx` (+ skeleton), register in `panels/index.tsx`.
5. **Tests / gallery** — auction expectation row if it’s part of a Section 8.2 composition; gallery fixture props.

Placement cells (`L1`, `C2`, …) only reorder within the existing zone grammar.

---

## Environment

See `.env.example`. Models are `provider:modelId` (e.g. `groq:openai/gpt-oss-120b`). Set the matching API key. Switch providers without code changes; verify with `bun run llm:smoke`.

| Variable | Role |
|---|---|
| `DATABASE_URL` | Neon connection string (never log it) |
| `DB_SCHEMA` | Isolated schema (default `gestalt`) |
| `MODEL_FAST` / `MODEL_WRITE` | Intent/plan vs copy/email |
| `FORCE_FALLBACK` | `1` = skip LLM entirely |
| `ALLOW_DB_RESET` | Must be `1` to drop schema |
| `BETTER_AUTH_SECRET` | Required to enable sign-in (min 16 chars) |
| `BETTER_AUTH_URL` | Public app origin (use Vite URL in dev so cookies work via `/api` proxy) |
| `WEB_ORIGIN` | Allowed CORS origin for credentialed requests |

---

## Repo layout

```
apps/server   Express API, registry, LLM, auction, migrations, seed
apps/web      React shell, panels, gallery (/gallery)
packages/shared   Zod schemas, constants, need templates, manifests
```

---

## Auth (Better Auth + Drizzle)

Sign-in is **optional**. Without an account the demo works as before. With `BETTER_AUTH_SECRET` set:

1. Boot migrates auth tables into `DB_SCHEMA` (`0002_auth.sql`).
2. Use **Sign in** / create account in the header (email + password).
3. Pins and dismissals are stored in `user_workspace_prefs` and restored on the next session.

Drizzle types live in `apps/server/src/db/auth-schema.ts`. Story data still uses the existing `postgres` tagged SQL loaders — the auction path is unchanged.

## Production roadmap (next)

1. OAuth / SSO (Google, Okta) on the same Better Auth instance  
2. Org membership + RBAC  
3. Move story queries onto Drizzle gradually  
4. Wire CRM / Slack / ticketing as fact sources (auction inputs stay normalized facts)

The adaptive engine (intent → needs → auction → morph → Why) stays the product core.
