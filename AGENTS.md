# Pholio — Agentic Coding Guidelines

> Durable, repo-level instructions for every AI coding agent that works on Pholio.
> Verified against the working tree on **2026-09-19** (branch `99-feature-balance-verification-and-debt-tracking-for-non-investment-accounts`).
> For the current in-flight work see **`OPENCode_HANDOFF.md`** in the repo root.

---

## 1. What Pholio Is

Pholio is a personal finance tracker and budgeting web app. Users model accounts
(chequing, savings, investments, credit cards, lines of credit, mortgages, loans, "Other"),
record income / expenses / transfers, track debts and promotions, run monthly budget
allocations, and see net worth over time.

| Area | Technology |
| ---- | ---------- |
| Runtime / package manager | **Bun** (`bun install`, `bun run …`, `bunx`) |
| Framework | **Next.js 15** App Router, **React 19** |
| Language | **TypeScript 5.9**, `strict: true` |
| Database / Auth | **Supabase** (PostgreSQL + RLS, Supabase Auth) |
| UI | Tailwind CSS 3.4, Radix UI, Shadcn primitives, Recharts, lucide-react, sonner, dnd-kit |
| State | React hooks; Zustand used sparingly |
| Logging | Pino (`src/lib/logger.ts`) |
| Email | Resend (templates in `supabase/templates/`) |
| Infra | Docker Compose (root), Redis, Vercel, GitHub Actions + semantic-release |
| Formatting | Prettier — tabs, width 120, CRLF, double quotes, trailing commas es5 (`.prettierrc`) |

Branches: `main` is the release branch, `development` the long-lived integration branch,
and features land through PRs (CI runs on PRs to either). Current feature branch:
`99-feature-balance-verification-and-debt-tracking-for-non-investment-accounts`.

---

## 2. Repository Layout

```
pholio/
├── AGENTS.md                     # this file (durable agent instructions)
├── OPENCode_HANDOFF.md           # snapshot of in-flight work (refresh or delete when stale)
├── README.md                     # quick start + env var list
├── docker-compose.yml            # Next app + redis
├── package.json                  # root scripts (Docker + db:migrate only)
├── scripts/migrate.js            # concatenates migrations into supabase/generated/
├── .agents/                      # AI agent role definitions
├── .context/
│   ├── development-principles.md # workflow / coding standards (read before large features)
│   ├── design-principles.md      # UI/UX standards
│   └── memories/                 # long-term memory: architecture.md, decisions.md, domain.md
├── docs/                         # feature specs (e.g. 99-balance-verification-spec.md)
├── supabase/
│   ├── config.toml
│   ├── migrations/               # numbered SQL, applied in filename order
│   ├── generated/                # GITIGNORED output of scripts/migrate.js
│   └── sample_data.sql
└── src/                          # the Next.js app (own package.json + node_modules)
    ├── app/                      # routes: allocations, balancesheet, dashboard, recurring,
    │   │                         #   settings, (auth-pages), auth, api, demo-components
    │   ├── <feature>/actions.ts  # server actions for that feature
    │   └── <feature>/components/ # feature-scoped components
    ├── components/               # shared: ui/ (shadcn), dialogs/, layout/, sidebar/, common/
    ├── hooks/
    ├── lib/                      # utils, supabase clients, errors, logger, sort-utils,
    │   │                         # account-utils, account-validation-utils, database.types.ts
    ├── lib/actions/              # cross-feature server actions (unified transactions, promotions)
    ├── lib/types/                # shared types (unified-transaction)
    ├── mock-data/                # sample data used when NEXT_PUBLIC_USE_SAMPLE_DATA=true
    ├── styles/, utils/, public/, scripts/
    └── .env.local                # GITIGNORED secrets (required for real data)
```

Two `package.json` files exist: run **app** commands from `src/`, **infra/DB** commands from the root.

---

## 3. Setup & Environment

Prerequisites: **Bun** and, for the Docker path, Docker Desktop. Install dependencies in
**both** the root and `src/`.

```bash
bun install                 # root (semantic-release tooling)
cd src && bun install       # app dependencies (required)
```

Environment files:

- `src/.env.local` — **gitignored, required for real data** (see README):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_PUBLISHABLE_KEY`, `LOCAL_SUPABASE_SERVICE_ROLE_KEY`,
  `RESEND_API_KEY`, `NEXT_PUBLIC_LOGO_DEV_TOKEN`, `LOGO_DEV_SECRET_KEY`.
- `.env` (root) — **tracked in git**; currently only `APP_VERSION`, `APP_ENV`, `REDIS_URL`.
  The release workflow bumps the version automatically — do not hand-edit versions in feature work.
- `NEXT_PUBLIC_USE_SAMPLE_DATA=true` switches the app to `src/mock-data` (no Supabase needed).

---

## 4. Commands

### App (`cd src`)

| Command | Purpose |
| ------- | ------- |
| `bun run dev` | Next dev server (real Supabase) on :3000 |
| `bun run dev:mock` | Dev server with `NEXT_PUBLIC_USE_SAMPLE_DATA=true` |
| `bunx tsc --noEmit` | **Type-check — primary gate, must exit 0** |
| `bun run build` | Production build — second gate, must exit 0 |
| `bun run start` | Serve the production build locally |

### Root / infra

| Command | Purpose |
| ------- | ------- |
| `bun start` | `docker-compose up` (app + redis), reads `.env` + `src/.env.local` |
| `bun run down` | Stop containers |
| `bun run clean-rebuild` | Rebuild image without cache and start |
| `bun run logs` | Tail Docker logs |
| `bun run db:migrate` | Concatenate `supabase/migrations/*.sql` into `supabase/generated/combined-migrations.sql` and `production-safe-update.sql` |

`db:migrate` does **not** execute SQL. The owner pastes the generated file into the Supabase
SQL editor; production is updated manually after a PR merges.

### Testing & linting

- **There is no automated test suite and no ESLint config in this repo.** Do not invent
  `bun test` / `bun run lint` commands.
- CI (`.github/workflows/ci.yml`) only runs `bun install && bun run build` in `src/` for PRs
  targeting `main`/`development`.
- Optional dead-code sweep used on this project:
  `cd src && bunx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false`.
  The repo is **not** clean under those flags — compare against the pre-existing baseline
  before treating a finding as new (see §10).

---

## 5. Verification Standard

A change is considered build-verified when **both** exit `0`:

```bash
cd src && bunx tsc --noEmit
cd src && bun run build
```

UI-affecting work additionally needs manual browser verification at **mobile (375px)** and
**desktop (1440px)**. `bun run dev:mock` is the fastest way to exercise UI without a database.
There is no automated regression suite; `docs/regression-test-spec.md` is an unfinished checklist.

### Always produce a manual verification guide

After every feature or change, always give the user a step-by-step guide to verify the work
by hand in the running app. Put it in your reply (not a new file) unless asked otherwise.

- Simple, direct wording. No buzzwords or filler.
- One action per step, followed by the exact result to expect.
- Name the page and the button or field the user must click.
- Cover the changed behavior, including edge cases and the failure path.
- Note which mode to use: `bun run dev` (real database) or `bun run dev:mock` (sample data).
- If a step needs a migration or setup first, say so at the top.

Example shape:

1. Open Balance Sheet, then click the account. Expect the account detail page.
2. Click Record Withdrawal, enter 50, submit. Expect a success toast and the balance drops by 50.

---

## 6. Coding Conventions

### Imports

- Use the `@/` alias (`@/*` → `src/*`); avoid deep relative paths across features.
- Order: React/Next → third-party → `@/…` local. Use `import type` for type-only imports.
- Do not barrel-import (`import * as UI from "@/components/ui"`).

### TypeScript

- `strict: true`, `noEmit: true`; avoid `any` (existing exceptions exist, e.g. chart internals).
- Handle `null`/`undefined` explicitly.
- Most Supabase calls are **untyped** (clients are not parameterised with `Database`), so
  `.from("…")` compiles even for tables missing from `src/lib/database.types.ts`. Presence in
  that file is not proof a table exists — check `supabase/migrations/`.
- `database.types.ts` is hand-maintained and incomplete (it has `users`, `transactions`,
  `recurring_expenses`, `recurring_transfers`; it does **not** have `accounts`, `account_types`
  or `account_promotions`). Import it as `import { Database } from "@/lib/database.types"`
  (it exports `Database`, not `Tables`).

### Naming

| Kind | Convention | Example |
| ---- | ---------- | ------- |
| Files (non-component) | kebab-case | `field-visibility.ts` |
| Files (components) | kebab-case file, PascalCase export | `PromotionsTrackerCard.tsx` |
| Functions | camelCase | `calculateAccountStanding` |
| Constants | UPPER_SNAKE | `CORE_TYPE_PRESETS` |
| Types | PascalCase | `AccountFieldConfig` |
| Hooks | `use` prefix | `useAllocationSync` |

### Formatting

Prettier: tabs, 120 columns, double quotes, CRLF. Format files you touch, but do not reformat
unrelated files — see §10 (line-ending churn).

**PowerShell warning:** never use `Get-Content`/`Set-Content` to round-trip source files that
contain emoji or non-ASCII text; it has corrupted files in this repo. Use the editor tool, or
.NET `[IO.File]::ReadAllText/WriteAllText` with explicit UTF-8. Also prefer `-LiteralPath` for
Next.js bracket paths such as `accountdetail/[id]/…`.

---

## 7. Architecture Patterns

### Server vs client components

Server Components are the default and fetch with `createClient()` from
`@/lib/supabase/server`. Add `"use client"` only for interactivity (forms, dialogs, hooks).
Mutate through **server actions** (`src/app/<feature>/actions.ts` or `src/lib/actions/*`),
never directly from client components.

### Database access

| Context | Import |
| ------- | ------ |
| Server components / server actions | `@/lib/supabase/server` |
| Client components | `@/lib/supabase/client` |

- Select explicit columns where practical (some older queries still use `*`).
- Parallelise independent reads with `Promise.all`.
- Every table is RLS-protected; server actions additionally filter by `user_id`.
- **Derived financial state belongs in PostgreSQL**, not best-effort client code: see
  `record_balance_change()` (`002_finance.sql`), the `SECURITY DEFINER` functions in
  `004_functions.sql`, and `recalculate_account_promotions()`
  (`006_core_account_types_and_promotion_progress.sql`).

### Error handling

- API routes: `asyncHandler` + typed errors from `src/lib/errors.ts`.
- Client components: `try/catch`, then `toast.success` / `toast.error({ description })`.
- Server-side logging uses the shared Pino `Logger` (`Logger.info|warn|error`). Do not use
  `console.log` in production paths.

### Component size

Keep components focused; extract form sections and sub-components. Existing files exceed the
300-line guideline (e.g. `UnifiedTransactionDialog.tsx` ~865 lines, `AddAccountDialog.tsx` ~566)
— split them when you are already substantially editing them, not as drive-by refactors.

---

## 8. Domain Rules That Must Not Be Broken

### Account types: `code` is the source of truth

- `account_types.code` is the stable machine key: `chequing | savings | investment |
  credit_card | line_of_credit | mortgage | loan | other`.
- **Never branch on `account_types.name` or `accounts.name`.** Names are display labels and
  can change. (Branch #99 removed all name-hinting from `field-visibility.ts` and
  `isInvestmentAccount()`; do not reintroduce it.)
- Field visibility resolves in this order (`src/app/balancesheet/field-visibility.ts`):
  1. core `code` → fixed preset in `CORE_TYPE_PRESETS`;
  2. `code === "other"` → per-account `accounts.field_visibility` JSONB;
  3. `code IS NULL` (legacy row awaiting guided migration) → temporary category-based bridge.
- The eight seeded types are `Chequing`, `Savings`, `Investment`, `Credit Card`,
  `Line of Credit`, `Mortgage`, `Loans`, `Other (Asset)`/`Other (Liability)` (both `code = "other"`).
- "Other" is user-configured per account and must always sort **last** in type dropdowns
  (`sortAccountTypes()` in `src/lib/account-utils.ts`).
- Users must not be able to create new account types. That path was deliberately removed from
  `AddAccountDialog`; do not restore it.

### Account classes and debt tracking

- `class` is `asset` or `liability` and is derived from the account type.
- Investment accounts (`code = "investment"`, legacy `category = investment/retirement`) are
  assets and are capped like any other asset — withdrawals/expenses cannot exceed the available
  balance. `isInvestmentAccount()` only distinguishes them so they can track contribution room
  instead of debt.
- Asset withdrawals/expenses/transfers-out are capped by available balance; liability
  payments/transfer-out are capped by remaining debt.
- A transaction affects an account only when it is tagged to that account.
- "Pay Remaining" settles full or partial debt and is recorded as **a transfer from a source
  account into the liability account** (not as a `payment` row).
- Overpayment is only allowed through the explicit "Allow Overpayment" opt-in in the dialogs.

### Promotions

- One promotion belongs to one account: `promotion_type` ∈
  `spend_threshold | deposit_threshold | maintaining_balance`, with a target, reward
  description and start/end window.
- Progress is computed in PostgreSQL by `recalculate_account_promotions(account_id)`, fired by
  an `AFTER INSERT/UPDATE/DELETE` trigger on `account_transactions`. Keep the calculation in
  the DB; a JS reimplementation will drift.
- `refreshAccountPromotions()` (server action) only exists for definition changes (dates,
  target, type) and for a manual refresh.

### Money and dates

- Amounts are `DECIMAL(15,2)` in Postgres; keep decimal precision, never round through float
  arithmetic for storage.
- Dates are stored as `DATE` / `YYYY-MM-DD`. Use `src/lib/date-utils.ts`
  (`parseLocalDate`, `getTodayDateString`, `formatDateString`, `differenceInDays`, …) instead of
  `new Date("YYYY-MM-DD")` or `toISOString().split("T")[0]`, which shift timezones.

### Ordering (ADR-003)

- Option lists shown in dialogs/selects are sorted alphabetically by the label the user reads,
  using `src/lib/sort-utils.ts` (`sortAlphabetically`, `compareAlphabetically`, case-insensitive,
  leading emoji ignored). Accounts use `sortAccounts()` (sorts by the formatted
  "Institution - Name" label); account types use `sortAccountTypes()`.
- Documented exceptions that must stay in their natural order: recurrence units
  (Days → Weeks → Months → Years), `ServiceAutocomplete` (logo.dev relevance order),
  chronological month selectors, and migration `sort_order` seeds.

### Migrations are non-destructive and idempotent

- Schema changes are **additive**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`.
- **Never `DELETE` rows referenced by foreign keys.** Retire them with `is_active = false`
  and filter on read (e.g. `getAccountTypes()` filters `is_active = true`).
- Every migration must be safe to re-run on an already-migrated database, because the owner
  applies the concatenated SQL manually and may re-run it.
- Migrations are applied in filename sort order. Note the existing duplicate prefix:
  `005_promotions_and_account_types.sql` and `005_storage.sql` (both are applied;
  `005_promotions…` sorts first). `000_destroy_and_reset.sql` is excluded by `scripts/migrate.js`
  and is only for local resets.

---

## 9. Things Agents Must Not Do

- **Do not commit, push, rebase, or open PRs unless explicitly asked.** This repo is often in a
  long-lived dirty working tree; committing mid-feature has caused rework.
- Do not stage or discard uncommitted work to "clean up" — inspect `git status` first and treat
  the working tree as the source of truth.
- Do not edit `supabase/generated/**` (gitignored build output) or `supabase/signing_keys.json`.
- Do not add a test runner, linter, or formatter config without being asked.
- Do not introduce generic name/text matching for account behavior, categories, or types.
- Do not duplicate DB-derived logic (balances, debt, promotion progress) in the client.
- Do not change RLS policies, table grants, or existing `SECURITY DEFINER` functions casually;
  they affect production data access.
- Do not run `supabase/migrations/000_destroy_and_reset.sql` against anything but a local DB.
- Do not reformat or re-save whole unrelated files (creates EOL noise that hides the real diff).

---

## 10. Known Pitfalls & Past Incidents

- **Line-ending churn.** Prettier is configured for CRLF but parts of the working tree are LF.
  A "full file rewrite" in `git diff` is often just EOL churn: `git diff --stat --ignore-cr-at-eol`
  shows the real change. Example on the current branch: `InsightsCard.tsx` appears as ~641
  changed lines raw, but only ~9 lines of real content.
- **PowerShell file corruption.** `Get-Content`/`Set-Content` mis-decoded UTF-8 emoji and
  mangled `AddAccountDialog.tsx`; a separate line-surgery command emptied the file. Use the
  editor tool / .NET UTF-8 APIs and length-check after bulk file surgery.
- **`noUnusedLocals` noise.** The repo has ~57 pre-existing unused locals/imports under
  `--noUnusedLocals --noUnusedParameters`. Do not use those flags as a gate; if you use them,
  diff against the baseline so pre-existing hits are not mistaken for regressions.
- **Mock mode must be maintained.** `src/mock-data/*` mirrors the real schema. When the model
  changes (new columns, new types), update `src/mock-data/balancesheet.ts` and any
  `NEXT_PUBLIC_USE_SAMPLE_DATA` branch in the corresponding `actions.ts`, otherwise
  `bun run dev:mock` silently diverges.
- **Client-only validation.** `createUnifiedTransaction` and related actions do **not**
  re-validate balance/debt caps server-side; the caps live in the dialogs. Treat that as a known
  gap (see `OPENCode_HANDOFF.md`), not as permission to rely on client validation.
- **Stale `.next`.** Build output lives in `src/.next` (gitignored). If a build fails
  confusingly, delete `src/.next` and rebuild.
- **Terminal output capture.** On this Windows setup, chained PowerShell commands sometimes
  return stale terminal content instead of the command's output. Write command output to a file
  and read it if a result looks wrong.

---

## 11. AI Agent Team & Workflow

Role definitions live in `.agents/`. They describe a multi-agent workflow; a single agent can
still follow the same routing logic.

| Agent role | Responsibility | Core focus |
| ---------- | -------------- | ---------- |
| `orchestrator` | Technical lead & coordinator | Triage, subagent routing, voting coordination, memory categorization |
| `system-architect` | System & database architect | Architecture decisions, schema, API contracts, scalability |
| `ui-ux-designer` | UI/UX specialist | Component hierarchy, design tokens, interaction flows, accessibility |
| `senior-engineer` | Implementation lead | Feature building, refactoring, local bug fixing |
| `code-reviewer` | Static QA & security auditor | Code quality, RLS/security, error handling, pattern compliance |
| `ui-flow-reviewer` | Visual & flow QA | Live browser testing, polish, 375/768/1440 responsiveness |

### Execution paths

1. **Low complexity** — delegate straight to implementation or review.
2. **Medium complexity** — spec (architect/designer) → build → review.
3. **High complexity** (schema-breaking or multi-domain) — solicit proposals, take structured
   votes (approve option A/B/conditional + rationale + risk), then synthesize a plan.

---

## 12. Dual Memory System

- **Long-term memory (tracked):** `.context/memories/`
  - `architecture.md` — tech stack, boundaries, data-safety and verification rules.
  - `decisions.md` — ADRs (ADR-001 agent governance, ADR-002 7 core account types,
    ADR-003 alphabetical ordering).
  - `domain.md` — domain concepts, account-type rules, promotions.
  Update these only for real architectural decisions, not for routine code changes.
- **Short-term memory (gitignored):** `.agents/scratch/memories/session-context.md` —
  transient session/scratch notes. It can go stale: on the current branch it describes an
  earlier state and some of its "open items" are already fixed in the working tree. Verify
  against code before trusting it.

---

## 13. Commit & Release Conventions

**Commits (only when the user says "commit"):**

- Write small, meaningful messages. One concern per commit.
- Do **not** use conventional-commit prefixes on commit messages. Plain short text only.
- Bundle the files that belong to one message; split unrelated changes into their own commit.
- Do **not** commit docs or agent files (e.g. `AGENTS.md`, `docs/`, `OPENCode_HANDOFF.md`)
  unless the user explicitly says to.

**Pull requests:**

- Title must start with `feat:` or `fix:` — the release pipeline reads it.
- Description must contain a **Summary** and a **Key changes** section.
- Base branch: `main` or `development`.

Expected workflow for a feature: spec in `docs/<feature>-spec.md`, implementation,
type-check + build, manual UI verification at 375px/1440px, review, PR.

---

## 14. Key Principles

- **Security first:** RLS everywhere, validate server-side, never expose the service-role key.
- **Type safety:** `strict` TypeScript, no casual `any`, handle null explicitly.
- **Performance:** parallelise independent queries; keep charts and dialogs lean.
- **Maintainability:** small focused files, document deviations.
- **Consistency:** follow existing patterns rather than inventing new ones.
- **Data safety:** non-destructive, idempotent migrations; retire rows, never delete them.

---

## 15. Maintaining This File

Update `AGENTS.md` when a durable rule, command, or architectural constraint changes
(then say so in the commit/PR). Keep session-specific status in `OPENCode_HANDOFF.md`
instead — it is a snapshot and will go stale.
