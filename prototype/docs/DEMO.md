# Demo day checklist

## Before you walk on stage

- [ ] `bun install` and `bun run db:check` show 4 clients (Acme present)
- [ ] `bun run db:migrate` then `bun run db:seed` so access-role users exist
- [ ] `bun run llm:smoke` passes for the provider you will use
- [ ] One dry run: `bun run dev` → steps 0–8 in README
- [ ] One dry run: `bun run demo:offline` → same steps (canned copy OK)
- [ ] Optional chat: `cd rag && uv sync && uv run gestalt-rag`; `RAG_SERVICE_URL` set in `.env`
- [ ] Confirm workspace works with RAG stopped (chat error banner only)
- [ ] Backup video of the **offline** run saved locally (and a copy on a second device)
- [ ] Close other Groq/OpenAI traffic so rate limits don’t steal the live demo
- [ ] Browser zoom 100%; window ≥ 1100px wide for the three-column layout

## Talking points (30 seconds each)

1. **Default dashboard is not a special case** — same auction, overview shape, no LLM.
2. **Every panel title is a question** — UI is organized around what the task needs answered.
3. **Why lens = receipts** — scores and exclusions from the auction, not an LLM story.
4. **Pivot morphs** — scope carries; shared panels keep identity (`layoutId`).
5. **Ambiguity is visual** — ghost previews, not a text interrogation.
6. **Offline is first-class** — fixtures keep the demo alive if the model dies.
7. **Access roles** — manager / developer / intern see different dashboards and chat retrieval (password `demo-password-1`).
8. **Chat is a sidecar** — if RAG is down, workspace keeps working; chat shows a clear error cue.

## Access-role walkthrough (after steps 0–8)

| Sign in | Expect |
|---|---|
| `manager@northwind.test` | Full portfolio + sales + Jira/Google writes; chat can surface management ARR notes |
| `developer@northwind.test` | All clients; eng-tagged story tickets + live Jira (read-only connectors); no sales_pulse / portfolio_health |
| `intern@northwind.test` | Acme-only; no Jira strip / open_issues / sales / capacity / blockers; calendar view-only; chat has no Jira/sales live sections |

Open the floating **Gestalt chat** FAB on `/app` (or `/chat`). With RAG running, ask normal questions (“Prepare me for Acme”, “Why did usage drop?”, “What Jira tickets are open?”) — answers stream as prose grounded in retrieved docs **plus live Postgres** and **Atlassian Jira** (user Connectors → Jira, or server `JIRA_*` env). Demo story tickets (H-T*, T-*) are labeled separately and only used when live Jira is unavailable. Managers can `POST /api/chat/reindex` to refresh Chroma from DB + Jira. Stop RAG and reopen chat — banner: “Chatbot service: an error occurred”; IntentBar on `/app` still works.

## If something breaks live

| Symptom | Move |
|---|---|
| LLM slow / rate limited | Switch to the offline video, or restart with `bun run demo:offline` |
| Session 404 after server restart | Hard refresh the tab |
| Empty panels / no Acme | `bun run db:check`; if zero clients, `bun run db:seed` |
| Wrong Neon “empty DB” | Data is in schema `gestalt`, not `public` |

## After the demo

Commit only when you intend to; draft messages were provided per milestone.  
Next engineering phase: Better Auth + Drizzle on Neon (see README roadmap).
