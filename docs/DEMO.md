# Demo day checklist

## Before you walk on stage

- [ ] `bun install` and `bun run db:check` show 4 clients (Acme present)
- [ ] `bun run llm:smoke` passes for the provider you will use
- [ ] One dry run: `bun run dev` → steps 0–8 in README
- [ ] One dry run: `bun run demo:offline` → same steps (canned copy OK)
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
