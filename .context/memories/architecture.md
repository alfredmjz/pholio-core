# Long-Term Memory: System Architecture

> **Storage Location**: `.context/memories/architecture.md` (Tracked in Repository)  
> **Purpose**: Persists key architectural patterns, tech stack choices, data structures, and security boundaries across developer sessions.

---

## Technical Stack & Infrastructure
- **Frontend / Framework**: Next.js 15 (App Router, React Server Components)
- **Backend / Database**: Supabase (PostgreSQL, Auth, Real-time)
- **Containerization**: Docker & Docker Compose
- **Language**: TypeScript (Strict Mode)

---

## Core Component Boundaries
- **Server Components (Default)**: Used for data fetching directly from Supabase, authorization checks, and initial SSR layout generation.
- **Client Components (`"use client"`)**: Isolated strictly to interactive elements, form handling, modal states, and client-side hooks.
- **Mutations & Business Logic**: Executed via Server Actions (`src/app/[feature]/actions.ts`) or dedicated API routes (`src/app/api/`) wrapped in centralized error handlers.

---

## Security & Data Access Patterns
- **Database Row Level Security (RLS)**: Mandatory on all PostgreSQL tables. Client operations must execute within authenticated RLS policies.
- **Input Validation**: All API inputs and Server Action payloads must be validated using Zod or centralized error validators (`src/lib/errors.ts`).

---

## Data Safety & Migration Rules (Established 2026-09-18)

- **Non-destructive migrations are mandatory.** Production data must never be missing or silently dropped. Schema changes must be **additive** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and followed by an explicit **data backfill** that moves existing rows onto the new model.
- **Never hard-delete rows that are referenced by foreign keys** (account types, statuses, categories). Retire records by setting an `is_active = false` flag and filter them out in queries instead.
- **Every migration must be safe to re-run** on an already-migrated database (guards: `IF NOT EXISTS`, `ON CONFLICT`, `DROP ... IF EXISTS`). The migration runner concatenates all files into `supabase/generated/production-safe-update.sql` and the user applies it manually via the Supabase SQL Editor.
- **Derived financial state** (account balances, ledger entries, promotion progress) is maintained by PL/pgSQL functions and triggers — see `record_balance_change()` (`002_finance.sql`) and the `SECURITY DEFINER` functions in `004_functions.sql` — not by best-effort client code.

---

## Verification Standard (Established 2026-09-18)

- There is no automated test suite. A change is considered build-verified when `cd src && bunx tsc --noEmit` and `cd src && bun run build` both exit `0`.
- UI-affecting work additionally requires manual browser verification at mobile (375px) and desktop (1440px) breakpoints.
