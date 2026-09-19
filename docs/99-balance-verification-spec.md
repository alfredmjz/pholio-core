# Issue #99 — Balance Verification, Debt Tracking, Promotions & 7-Core Account Types

**Status:** 🟡 In Progress
**Created:** 2026-09-18
**Owner:** orchestrator (AI)
**Branch:** `99-feature-balance-verification-and-debt-tracking-for-non-investment-accounts`

## Quick Context

Issue #99 ships three coupled features in one PR:

- **(A) Balance verification & debt tracking** for non-investment accounts (standing rules, caps, overpayment handling).
- **(B) Account promotions / welcome bonuses** (spend / deposit / maintaining-balance reward goals).
- **(C) Seven core account types + "Other"** replacing the legacy account-type catalogue.

## 1. Account Type Model (final)

Eight selectable types. `code` is the stable machine key; `name` is a display label only, so no logic may match on the name.

| code | name | class | category | Preset fields |
| ---- | ---- | ----- | -------- | ------------- |
| `chequing` | Chequing | asset | banking | balance only |
| `savings` | Savings | asset | banking | target goal, APY |
| `investment` | Investment | asset | investment | contribution room (covers retirement / tax-advantaged) |
| `credit_card` | Credit Card | liability | credit | credit limit, APR, due date |
| `line_of_credit` | Line of Credit | liability | credit | credit limit, variable APR (no due date) |
| `mortgage` | Mortgage | liability | debt | original amount, rate, loan term, due date |
| `loan` | Loans | liability | debt | original amount, APR, loan term, due date |
| `other` | Other | asset **or** liability | other | **per-account user-configured** |

Category set is reduced to `banking | investment | credit | debt | other` (`property` and `retirement` removed; retirement folds into `investment`).

### Field visibility resolution

1. Core codes → fixed preset (`CORE_TYPE_PRESETS` in `src/app/balancesheet/field-visibility.ts`).
2. `other` → the account's own `field_visibility` JSONB config (user toggles each field on/off).
3. Legacy rows with `code IS NULL` (accounts not yet migrated) → a **temporary bridge** derived from the legacy type's stored `category`. The guided migration screen removes this state.

## 2. Data Model Changes

| Change | Object | Notes |
| ------ | ------ | ----- |
| `code TEXT` | `account_types` | stable key; `NULL` for legacy/custom rows |
| `field_visibility JSONB` | `accounts` | user field config for `other` accounts |
| `account_promotions` | new table | promotions, RLS + updated_at trigger |
| `recalculate_account_promotions(uuid)` | new function | derives progress from ledger + balance |
| trigger on `account_transactions` | new | recalculates promotions on insert/update/delete |

## 3. Migration Strategy (non-destructive — mandatory)

All statements are idempotent and additive. **No row is ever deleted.**

1. `ADD COLUMN IF NOT EXISTS code` / `field_visibility` with guards.
2. Upsert the eight core types by `(user_id, name)` so the pre-existing "Credit Card" / "Line of Credit" / "Mortgage" rows receive their `code`, `category`, `sort_order` and icon.
3. Retire legacy system types and all user-created custom types with `is_active = false` (keeps FKs valid; `getAccountTypes()` filters `is_active = true`).
4. Backfill promotion progress once for every account with an open promotion.
5. `GRANT ALL ... TO authenticated` for the new table.

**Guided re-selection (app side):** users who already have ≥1 account whose type is retired/legacy get a one-time migration dialog listing those accounts so they can choose one of the eight types (with the "Other" field configurator available). Nothing changes automatically — matching the product decision that account typing is user-controlled.

Production is updated manually by the owner **after** the PR merges, by running `supabase/generated/production-safe-update.sql`.

## 4. Debt & Standing Rules

- Investment accounts (`code = 'investment'`) are **exempt** from balance/debt caps and track contribution room instead.
- Asset accounts: withdrawals/expenses/transfers-out are capped at the available balance.
- Liability accounts track **Total Accumulated Debt**, **Payments Made**, **Remaining Debt**.
- Liability payments and transfer-out are capped at remaining debt; transfers out of a liability are additionally bounded by available credit.
- Transactions affect an account's debt/balance **only when the transaction is tagged to that account**.
- **Pay Remaining** settles full or partial outstanding debt and is recorded as a **transfer from a source account x → the liability account y**.
- Overpayment is only possible through the explicit "Allow Overpayment" opt-in in the transaction dialogs.

## 5. Promotions

- Progress is derived in PostgreSQL (`recalculate_account_promotions`) and maintained by an `AFTER INSERT/UPDATE/DELETE` trigger on `account_transactions`, mirroring `record_balance_change()` (`002_finance.sql`) and the `SECURITY DEFINER` functions in `004_functions.sql`.
- `spend_threshold` counts charges (withdrawals/adjustments) inside the window; `deposit_threshold` counts deposits/contributions/positive inflows; `maintaining_balance` reads `accounts.current_balance`.
- A thin `refreshAccountPromotions(accountId)` server action remains available for the UI after editing a promotion's dates or target.

## 6. Verification Plan

1. `cd src && bunx tsc --noEmit` → exit 0.
2. `cd src && bun run build` → exit 0.
3. Re-run the migration against development to prove idempotency (no duplicates, legacy rows stay retired).
4. Manual: create each of the 8 account types; confirm presets and the "Other" configurator; pay down a liability via Pay Remaining (partial + full); verify promotion progress updates on transaction create/edit/delete.

## Out of Scope

- Bank-institution statement import (future source of truth for real debt balances).
- Social finance / split-bill debts (see `docs/social-finance-spec.md`).
- Automated recurring transfers between accounts (branch #100).

