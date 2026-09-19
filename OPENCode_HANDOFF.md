# OpenCode Handoff — Pholio, issue #99 branch

**Snapshot date:** 2026-09-19
**Written by:** Cline, before the user switched to OpenCode
**Branch:** `99-feature-balance-verification-and-debt-tracking-for-non-investment-accounts` (HEAD `55a997f`)
**Build state at handoff:** `cd src && bunx tsc --noEmit` → exit 0, `cd src && bun run build` → exit 0.
**Working tree:** dirty — all issue-#99 work is uncommitted. Nothing has been committed or pushed.

> Read `AGENTS.md` first for durable project rules. This file is the current-work snapshot and
> will go stale; verify against code before trusting any statement here.

---

## 1. Current Objective

Issue **#99** ships three coupled features in one upcoming PR:

- **(A) Balance verification & debt tracking** for non-investment accounts — standing rules,
  caps, overpayment handling, "Pay Remaining".
- **(B) Account promotions / welcome bonuses** — spend, deposit and maintaining-balance reward
  goals with progress derived from the ledger.
- **(C) Eight selectable account types** (`chequing`, `savings`, `investment`, `credit_card`,
  `line_of_credit`, `mortgage`, `loan`, `other`) **replacing** the legacy account-type catalogue.

Authoritative spec: **`docs/99-balance-verification-spec.md`** (written this session).
Success criteria from that spec: type-check + build exit 0; migration re-run proves idempotency;
manual check of all 8 types, the "Other" configurator, partial + full Pay Remaining, and
promotion progress on transaction create/edit/delete.

---

## 2. Current Status

### Completed (code present, type-check + build verified)

- **Spec** written: `docs/99-balance-verification-spec.md`.
- **Migrations**
  - `supabase/migrations/005_promotions_and_account_types.sql` — guards `recurring_transfers`,
    adds `account_transactions.recurring_transfer_id`, seeds the 7 core system types,
    creates `account_promotions` (+ RLS policy, `updated_at` trigger, index).
  - `supabase/migrations/006_core_account_types_and_promotion_progress.sql` — adds
    `account_types.code`, upserts/normalises the 9 core rows (8 selectable types — `Other`
    exists once per class), retires legacy + all user-created
    types with `is_active = false` (no deletes), adds `accounts.field_visibility`,
    `GRANT ALL ON account_promotions`, `recalculate_account_promotions()`, the
    `account_transactions` trigger and a one-time backfill. Idempotent by design.
  - `supabase/migrations/003_budgeting.sql` gained an `ADD COLUMN IF NOT EXISTS
    recurring_transfer_id` guard for databases deployed before that column existed.
  - Session notes say 005 and 006 were applied to the **development** database only.
    **Production has not been updated**; the owner applies
    `supabase/generated/production-safe-update.sql` manually after merge.
- **Account-type model refactor** (`src/app/balancesheet/types.ts`, `field-visibility.ts`,
  `src/lib/account-utils.ts`, `AccountCard.tsx`, `AddAccountDialog.tsx`, `EditAccountDialog.tsx`,
  `AccountStats.tsx`, `InsightsCard.tsx`, `AssetPerformance.tsx`, `BalanceCard.tsx`) —
  behaviour is driven by `account_types.code`; `AccountCategory` reduced to
  `banking | investment | credit | debt | other`; new types `AccountTypeCode` and
  `AccountFieldConfig`; all name-based hinting removed.
- **Custom account-type creation removed** — `createAccountType` action, the combobox
  "Create …" affordance and `CreateAccountTypeInput` are gone; the type list is a fixed dropdown.
- **Guided type-migration UI** — `getAccountsNeedingTypeMigration()` / `migrateAccountTypes()`
  (`src/app/balancesheet/actions.ts`), `AccountTypeMigrationNotice.tsx`,
  `AccountTypeMigrationDialog.tsx`, `AccountFieldConfigurator.tsx`, mounted in
  `src/app/balancesheet/client.tsx` as the first child of the page content.
- **Promotions end-to-end** — types in `balancesheet/types.ts`, `src/lib/actions/promotion-actions.ts`
  (CRUD + `refreshAccountPromotions()` RPC wrapper + mock store), `PromotionDialog.tsx`,
  `PromotionsTrackerCard.tsx` (mounted in `AccountDetailClient`), DB-side progress.
- **Debt/standing feature** — `src/lib/account-validation-utils.ts`
  (`isInvestmentAccount`, `calculateAccountStanding`, `validateTransactionAmount`),
  `AccountStandingCard.tsx`, validation + "Allow Overpayment" wired into both
  `UnifiedTransactionDialog.tsx` and `allocations/components/TransactionDialog.tsx`,
  `defaultAmount` / `defaultFromAccountId` / `defaultToAccountId` / `"transfer"` props added to
  `UnifiedTransactionDialog`.
- **ADR-003 alphabetical ordering** — `src/lib/sort-utils.ts`, `sortAccounts()` /
  `sortAccountTypes()` in `src/lib/account-utils.ts`, applied in `ManagePresetsDialog`,
  `UnifiedTransactionDialog` (presets), `AddAccountDialog`, `AccountTypeMigrationDialog`,
  allocations dialogs and `autocomplete-input.tsx`; hand-authored enums reordered.
- **Mock mode aligned** — `src/mock-data/balancesheet.ts` now has 9 types with `code` (7 core +
  `Other (Asset)` + `Other (Liability)`), `createAccount`/`updateAccount` mock branches
  (`buildSampleAccount`), `samplePromotionsStore` in `promotion-actions.ts`, and
  month-aware `sampleAllocationStore` in `src/app/allocations/actions.ts`.
- **Minor cleanups** — unused imports removed in several touched files (e.g. `Suspense` in
  `balancesheet/page.tsx`, `createAccountType` import, `restrictToParentElement`).

### Partially completed / needs verification

- **No manual/browser QA has been done.** `tsc` + `build` are green, but no UI flow has been
  exercised in a browser at any viewport. Treat all visual/behavioural claims as unverified.
- **Debt math is heuristic and unvalidated against real ledger data** (see §6).
- **`EditAccountDialog.tsx`** — the diff includes `field_visibility` handling and imports
  `AccountFieldConfigurator`; confirm the configurator actually renders for `code === "other"`
  and persists (I did not read the whole file).
- **Server-side enforcement of caps does not exist** — validation is client-only (see §6).
- **`src/lib/database.types.ts` is not updated** for `accounts`, `account_types`,
  `account_promotions` (works only because the Supabase clients are untyped).
- **Unused symbols remain in touched files** (the normal `tsc` gate passes, but
  `--noUnusedLocals` reports): `PromotionsTrackerCard.tsx` (`isLoading`),
  `balancesheet/client.tsx` (`transactions`, `isLoadingTransactions`),
  `NetWorthCard.tsx` (`formatFullCurrency`),
  `allocations/components/TransactionDialog.tsx` (`setAllowOverpayment`),
  `OtherAccountsCard.tsx` (`currentAccountClass`), plus pre-existing hits elsewhere.
- **`supabase/generated/*.sql`** currently includes migration 006 but is gitignored build
  output. Regenerate with `bun run db:migrate` immediately before the production apply.

### Not started

- Removing the `TODO(#99-cleanup)` scaffolding (see §8, "Ideas for later").
- Any commit, PR, changelog entry, or version bump.
- Bank-statement import (spec: explicitly out of scope).
- Automated recurring transfers between accounts (branch #100, out of scope).
- Social finance / split bills (separate `docs/social-finance-spec.md`).

### Currently broken (statically identified, not browser-confirmed)

1. **Pay Remaining pre-fills source == destination.** `AccountDetailClient.tsx` (lines 233-237)
   passes `defaultAccountId={account.id}` **and** `defaultToAccountId={account.id}`;
   `UnifiedTransactionDialog` (line 151) resolves the source as
   `defaultFromAccountId || defaultAccountId`. Both selectors therefore point at the liability
   account, and `createUnifiedTransaction` rejects transfers whose source and destination are
   equal ("Source and destination accounts must be different"). The user has to change the
   source manually, so the headline Pay Remaining flow almost certainly fails as written.
2. Nothing else is known to be broken. Type-check and production build both pass.

---

## 3. What We Changed (this session)

Grouped by area: **files → what changed → why**.

### 3.1 Account types become code-driven (feature C)

| Files | Change | Why |
| ----- | ------ | --- |
| `src/app/balancesheet/types.ts` | `AccountCategory` reduced to `banking \| investment \| credit \| debt \| other`; added `AccountTypeCode`, `AccountFieldConfig`; `AccountType.code`, `Account.field_visibility`, promotion + migration types | `category` alone cannot distinguish Chequing/Savings, Credit Card/LOC, Mortgage/Loans; names are rename-fragile display labels |
| `src/app/balancesheet/field-visibility.ts` | Rewritten: `CORE_TYPE_PRESETS` keyed by code; `customFieldVisibility()` for `other`; `legacyCategoryVisibility()` bridge for rows with `code IS NULL`; `getFieldVisibility(type, customConfig)` | Single deterministic field-preset resolver with no name matching |
| `src/lib/account-validation-utils.ts` (new) | `isInvestmentAccount()` keys off `code === "investment"` or legacy `category`; `calculateAccountStanding()`; `validateTransactionAmount()` | Debt/standing logic previously inferred from the account name |
| `AccountCard.tsx`, `AccountStats.tsx`, `AssetPerformance.tsx`, `BalanceCard.tsx`, `InsightsCard.tsx` | Switched to `getFieldVisibility(account.account_type, account.field_visibility)`; liability label uses `isInvestmentAccount()` | Consistency with the code-driven model |
| `AddAccountDialog.tsx` | Removed `handleCreateType`/`createAccountType`; type combobox is select-only (`sortAccountTypes`); "Other" shows `AccountFieldConfigurator`; sends `field_visibility` | Enforce "8 types cover everything"; per-account config for `other` |
| `EditAccountDialog.tsx` | `field_visibility` handling + configurator import | Let owners change an existing "Other" field set |
| `src/mock-data/balancesheet.ts` | 9 sample types with `code`; TFSA re-pointed to Investment; `buildSampleAccount` for create/update mock branches | `dev:mock` must mirror the new schema |

### 3.2 Non-destructive migration + retirement (feature C)

- `supabase/migrations/006_core_account_types_and_promotion_progress.sql` is the keystone:
  `ADD COLUMN IF NOT EXISTS code`, upsert of the 9 core rows, `UPDATE ... SET is_active = false`
  for legacy system types and **all** user-created types, `accounts.field_visibility`,
  promotion grants + trigger + backfill.
- Rationale: `accounts.account_type_id` is `ON DELETE RESTRICT`, production data must never be
  lost, and `getAccountTypes()` already filters `is_active = true`, so retirement is invisible
  to the dropdown while existing accounts keep working.
- Existing accounts are **never** re-typed automatically; the guided dialog asks the owner.

### 3.3 Guided type migration (feature C)

| Files | Change | Why |
| ----- | ------ | --- |
| `balancesheet/actions.ts` | `getAccountsNeedingTypeMigration()` (accounts whose type is `!is_active` or has no `code`), `suggestCodeForLegacyCategory()`, `migrateAccountTypes(updates)` | Owner-controlled re-typing; suggestions come from the retired category only, never the name |
| `components/AccountTypeMigrationNotice.tsx` (new) | Self-terminating amber banner; no stored flag | Disappears by itself once no account needs re-typing |
| `components/AccountTypeMigrationDialog.tsx` (new) | Per-account class → type selection, class-change warning, inline "Other" configurator | Explicit confirmation per account |
| `components/AccountFieldConfigurator.tsx` (new) | 7 switch rows (all default off) | Define which fields an "Other" account tracks |
| Notice mounted in `client.tsx` | First child inside `PageContent` | Previously rendered behind the page header when placed in `page.tsx` |

### 3.4 Promotions (feature B)

| Files | Change | Why |
| ----- | ------ | --- |
| `supabase/migrations/005_…` | `account_promotions` table + RLS + trigger + index | Persist promotions per account |
| `supabase/migrations/006_…` | `recalculate_account_promotions(account_id)`, `trg_account_promotions_recalc()`, trigger on `account_transactions`, one-time backfill | Progress must be derived in one place and stay correct on create/edit/delete; mirrors the existing `record_balance_change()` pattern |
| `balancesheet/types.ts` | `PromotionType`, `AccountPromotion`, `CreatePromotionInput`, `UpdatePromotionInput` | Shared types |
| `src/lib/actions/promotion-actions.ts` (new) | CRUD + `refreshAccountPromotions()` RPC wrapper + in-memory `samplePromotionsStore` | Only definition changes need a manual refresh (dates/target/type) |
| `PromotionDialog.tsx`, `PromotionsTrackerCard.tsx` (new) | Create/edit dialog and tracker card with progress %, days left and required daily pace | UI for the feature; the card is mounted on the account detail page |
| `lib/date-utils.ts` | Added `differenceInDays()` | Used for "days left" / pace |

### 3.5 Debt, standing and Pay Remaining (feature A)

| Files | Change | Why |
| ----- | ------ | --- |
| `account-validation-utils.ts` | `AccountStanding` (`isExempt`, class, accumulated debt, payments, remaining debt, available balance, max allowed) | Single source for both the numbers shown and the caps enforced |
| `AccountStandingCard.tsx` (new) | Liability card (debt / payments / remaining + Pay Remaining button), asset card (available balance), investment exempt card | Surface the standing rules in the UI |
| `AccountDetailClient.tsx` | Mounts `AccountStandingCard` (with real transactions) and `PromotionsTrackerCard`; Pay Remaining sets `payRemainingAmount` then opens `UnifiedTransactionDialog` with transfer defaults | Pre-fill the "settle debt as a transfer" flow |
| `UnifiedTransactionDialog.tsx` | New props `defaultAmount`, `defaultFromAccountId`, `defaultToAccountId`, `"transfer"` default type; client-side standing panel; `allowOverpayment` opt-in checkbox | Caps + explicit overpayment escape hatch |
| `allocations/components/TransactionDialog.tsx` | Same standing validation + `allowOverpayment`; category list sorted | Consistent caps in the allocations flow |

### 3.6 Ordering (ADR-003) and mock-mode fixes

- `src/lib/sort-utils.ts` (new): `compareAlphabetically` / `sortAlphabetically` — case-insensitive,
  ignores leading emoji, numeric-aware.
- `src/lib/account-utils.ts`: `sortAccounts()` now sorts by the formatted
  "Institution - Name" label; new `sortAccountTypes()` forces `code === "other"` last.
- Applied in `ManagePresetsDialog`, `UnifiedTransactionDialog` (presets + enums),
  `AddAccountDialog`, `AccountTypeMigrationDialog`, `autocomplete-input.tsx`,
  `allocations/components/TransactionDialog.tsx` and the recurring dialog.
- `src/app/allocations/actions.ts`: month-aware in-memory `sampleAllocationStore`
  (`getAllocation` / `getOrCreateAllocation` / `getAllocationSummary`) — fixes mock mode
  showing "No Budget" when navigating to a month other than the seeded one.

---

## 4. Current Implementation (how the relevant parts work)

### 4.1 Account-type resolution

`getFieldVisibility(type, customConfig)` in `src/app/balancesheet/field-visibility.ts`:

1. `type.code === "other"` → `customFieldVisibility(config)` (all 7 flags default off, driven by
   `accounts.field_visibility`).
2. any other non-null `code` → `CORE_TYPE_PRESETS[code]`
   (`chequing`, `savings`, `investment`, `credit_card`, `line_of_credit`, `mortgage`, `loan`).
3. `code` is null (legacy/retired type awaiting re-selection) → `legacyCategoryVisibility(category)`:
   `investment`/`retirement` → investment preset; `credit` → credit-card preset; `debt` → loan
   preset; `banking`/`other`/null → savings-ish preset (target goal + APY). This is a temporary
   bridge only; it never looks at names.

`isInvestmentAccount(account)` returns true when `account.account_type.code === "investment"`,
or when the legacy category is `investment`/`retirement`. It is used for the exemption from caps
and to hide the "Remaining Debt to Date" label.

### 4.2 Retiring legacy types + guided migration

- Migration 006 retires (`is_active = false`) every system type whose name is not one of the
  eight core rows, and **every** user-created type (`user_id IS NOT NULL`). No row is deleted.
- `getAccountsNeedingTypeMigration()` loads the user's active accounts with
  `account_type:account_types(*)` and keeps accounts where
  `!account_type.is_active || !account_type.code`. The suggestion comes from
  `suggestCodeForLegacyCategory(category)`: investment/retirement → `investment`;
  credit → `credit_card`; debt → `loan`; other/property → `other`; everything else → `chequing`.
- `migrateAccountTypes(updates)` updates `account_type_id` and `field_visibility`
  (`null` unless the chosen type is `other`), one account at a time, then revalidates
  `/balancesheet` and `/dashboard`. It is **not** transactional: a failure part-way leaves
  earlier rows migrated and returns `false`.
- `AccountTypeMigrationNotice` renders only while `getAccountsNeedingTypeMigration()` returns a
  non-empty array (self-terminating, no stored flag); dismissal is component-local state.
- `AccountTypeMigrationDialog` loads the active types, sorts them with `sortAccountTypes()`,
  filters by the account's class, and warns when the owner flips asset ↔ liability.

### 4.3 Promotion progress (SQL)

`public.recalculate_account_promotions(p_account_id UUID)` (migration 006, `SECURITY DEFINER`):

- Early-returns when the account has no promotion with `is_completed = false`.
- Reads `accounts.current_balance` once.
- For each open promotion inside the loop:
  - `maintaining_balance` → progress = current balance.
  - `deposit_threshold` → `SUM(ABS(amount))` over `account_transactions` in
    `[start_date, end_date]` where `transaction_type IN ('deposit','contribution') OR amount > 0`.
  - else (`spend_threshold`) → `SUM(ABS(amount))` in the window where
    `transaction_type IN ('withdrawal','adjustment') OR amount > 0`.
  - Writes `current_amount`, `is_completed = progress >= target_amount`, `updated_at`.
- `trg_account_promotions_recalc()` is an `AFTER INSERT OR UPDATE OR DELETE` trigger on
  `account_transactions` calling the function with `COALESCE(NEW.account_id, OLD.account_id)`.
- Migration 006 backfills every account with an open promotion once.

> The `OR amount > 0` clause makes the two threshold types overlap for positive-amount rows.
> Amount sign conventions differ between asset accounts (deposits positive) and liability
> accounts (charges positive), so verify the intended semantics before relying on either
> threshold type (see §6).

### 4.4 Standing / debt math

`calculateAccountStanding(account, transactions?, asOfDate = today)`:

- Investment → `isExempt: true`, `maxAllowedTransaction: Infinity`.
- Asset → `availableBalance = account.current_balance`,
  `maxAllowedTransaction = max(0, current_balance)`.
- Liability **without** transaction history → `baseOriginal = original_amount ?? credit_limit ??
  current_balance`, `remainingDebt = max(0, current_balance)`,
  `totalAccumulatedDebt = max(baseOriginal, remainingDebt)`,
  `totalPayments = max(0, totalAccumulatedDebt - remainingDebt)`.
- Liability **with** history → keep transactions with `transaction_date <= asOfDate`;
  `payment`/`refund` add to `totalPayments`, `withdrawal`/`interest`/`adjustment`/`deposit` add to
  `accumulatedCharges`, anything else is split by the sign of `amount`;
  `initialPrincipal = original_amount ?? credit_limit ?? 0`;
  `totalAccumulatedDebt = max(initialPrincipal + accumulatedCharges, current_balance + totalPayments)`;
  `remainingDebt = max(0, totalAccumulatedDebt - totalPayments)`.

`validateTransactionAmount(account, amount, txIntent, standing)`:

- Exempt accounts always pass.
- Liability + (`income` | `payment` | `transfer`) fails when `amount > remainingDebt`
  (and `remainingDebt > 0`); returns a warning + `maxAllowed`.
- Asset + (`expense` | `withdrawal` | `transfer`) fails when `amount > availableBalance`.

`AccountStandingCard` calls it with the account's **real transactions**;
`UnifiedTransactionDialog` and `allocations/TransactionDialog` call it with `undefined`
(no history available in the dialog), so the two surfaces can report different numbers.

### 4.5 Validation and the Pay Remaining flow

- Both dialogs compute `selectedTargetAccount` and `validationResult` on every render.
  For `type === "transfer"` they validate the **source** account (`fromAccountId`); the
  destination is not capped client-side.
- `allowOverpayment` is local component state (a checkbox). It only bypasses client validation;
  it is not sent to the server, not persisted, and not audit-logged.
- `createUnifiedTransaction` (transfer branch) rejects missing/equal from/to accounts, creates a
  `source: "transfer"` allocation row, fetches both accounts, then writes account transactions /
  balances. It does **not** re-check balance/debt caps.
- Pay Remaining data flow: `AccountStandingCard` button → `onPayRemaining(standing.remainingDebt)`
  → `AccountDetailClient` `setPayRemainingAmount(amount)` + open the dialog →
  `UnifiedTransactionDialog` receives `accounts={[account, ...otherAccounts]}`, `defaultAmount`,
  `defaultToAccountId=account.id`, `defaultType="transfer"`.
  **Bug:** the source defaults to `defaultFromAccountId || defaultAccountId` and
  `AccountDetailClient` passes `defaultAccountId={account.id}`, so source == destination.

### 4.6 Ordering helpers

`src/lib/sort-utils.ts`: `toSortKey()` strips everything before the first alphanumeric
(`[0-9A-Za-zÀ-ÿ]`), then `localeCompare(..., { sensitivity: "base", numeric: true })`.
`sortAlphabetically(items, getLabel)` returns a new array and never mutates.
`sortAccounts()` sorts by `formatAccountDisplayName()`; `sortAccountTypes()` sorts core types
alphabetically and appends `code === "other"` last.

### 4.7 Mock mode

`NEXT_PUBLIC_USE_SAMPLE_DATA=true` makes every relevant server action short-circuit to
`src/mock-data/*`:

- `sampleAccountTypes` = 9 types with `code` (ids `type-1`…`type-9`); `sampleAccounts` reference
  them by index.
- `balancesheet/actions.ts` has mock branches for `createAccount`/`updateAccount`
  (`buildSampleAccount`) so the Add/Edit dialogs work without a DB.
- `promotion-actions.ts` keeps an in-memory `samplePromotionsStore` seeded with one promotion on
  `acc-4`.
- `allocations/actions.ts` keeps an in-memory `sampleAllocationStore` keyed `"YYYY-M"`.
- `getAccountsNeedingTypeMigration()` returns `[]`, and `migrateAccountTypes()` returns `false`
  in mock mode (the guided banner never appears).

---

## 5. Important Decisions

| # | Decision | Why |
| - | -------- | --- |
| 1 | Account behaviour dispatches on `account_types.code`, never on names | `category` alone cannot separate Chequing/Savings (both `banking`), Credit Card/LOC (both `credit`) or Mortgage/Loans (both `debt`); names are editable labels |
| 2 | The **8 core types replace** the legacy catalogue (not additive) | Product decision: the 8 types must cover every realistic account; no fallbacks |
| 3 | Two `Other` rows exist — `Other (Asset)` and `Other (Liability)` — both with `code = 'other'` | "Other" needs a class, and the class drives net-worth treatment; the `code` stays shared so per-account `field_visibility` config is reused |
| 4 | Legacy + custom types are **retired with `is_active = false`**, never deleted | `accounts.account_type_id` is `ON DELETE RESTRICT`; production data must not be lost. `getAccountTypes()` filters `is_active = true` |
| 5 | Existing accounts are **never** re-typed automatically; a guided dialog asks the owner | Account typing is user-controlled; a wrong auto-remap is worse than an extra prompt |
| 6 | No `property` or `retirement` category | "House" becomes a Mortgage account; retirement folds into `investment` (+ contribution room) |
| 7 | Promotion progress is computed in PostgreSQL and fired by a trigger | Mirrors the existing `record_balance_change()` / `SECURITY DEFINER` pattern; JS recalculation drifts and misses edit/delete paths |
| 8 | Promotion recalculation is awaited, not fire-and-forget | Explicit request; avoids the UI reading stale progress right after a write |
| 9 | Pay Remaining is recorded as a **transfer from a source account into the liability account** | Keeps the ledger consistent (money really moves); a `payment`-type row on the liability alone would not model the source outflow |
| 10 | Overpayment requires an explicit "Allow Overpayment" opt-in | Caps are the default; exceeding them must be deliberate |
| 11 | Dialog option lists are sorted alphabetically (ADR-003), with documented exceptions | Predictable, scannable dropdowns. Exceptions: recurrence units (Days→Weeks→Months→Years), `ServiceAutocomplete` (logo.dev relevance), month selectors (chronological) |
| 12 | "Other" is forced last in account-type dropdowns | It is the escape hatch, not an alphabetical entry |
| 13 | Migrations must be additive and idempotent; production is applied manually by the owner | The concatenated SQL is pasted into the Supabase SQL editor and may be re-run |

### Rejected / considered-and-dropped approaches

- **`category`-only dispatch** — cannot distinguish the six non-banking-relevant pairs of types.
- **Name-based dispatch** (the branch started this way) — rename-fragile; all name hinting was removed.
- **Deleting legacy/custom account types** — blocked by FK `ON DELETE RESTRICT` and unsafe for production.
- **SQL auto-remap of `accounts.account_type_id` to the closest core type** — rejected in favour of explicit user confirmation.
- **Adding a `property` category for houses** — rejected; Mortgage covers it.
- **JS promotion progress recalculation** — replaced by the DB function + trigger.
- **Custom account-type creation from the Add-account combobox** — removed; it breaks the "8 types cover all" invariant.
- **Alphabetising recurrence units / service autocomplete** — explicitly excluded from ADR-003.

---

## 6. Known Problems, Edge Cases & Technical Debt

Ordered roughly by risk. `[confirmed]` = I read the code and the statement follows directly;
`[uncertain]` = plausible but needs product/DB verification.

1. **[confirmed] Pay Remaining opens an invalid transfer** (source == destination). See §2 and §4.5.
2. **[confirmed] Standing numbers disagree between surfaces.** `AccountStandingCard` passes real
   transactions; both dialogs pass `undefined`, so liability math falls into the
   `original_amount ?? credit_limit ?? current_balance` branch. A user can see one
   "Remaining Debt" on the card and a different cap in the dialog.
3. **[confirmed] No server-side enforcement.** `createUnifiedTransaction` /
   `updateUnifiedTransaction` never re-check caps; a crafted request (or a buggy caller) can drive
   an asset balance below zero or overpay a liability. Security/correctness gap.
4. **[confirmed] "Allow Overpayment" is not persisted or audited** — it only skips client
   validation, so the override cannot be reported later.
5. **[uncertain] Liability debt math is heuristic.** In the with-history branch `deposit` counts
   as a charge, `original_amount`/`credit_limit` can double-count against
   `current_balance + payments` via `max(...)`, and `loan_start_date` / `payment_due_date` /
   interest accrual are ignored. For a credit card whose `current_balance` is already the debt,
   `totalAccumulatedDebt` can be inflated. Needs a written formula + real-data validation.
6. **[uncertain] Promotion thresholds overlap.** `OR amount > 0` appears in both the spend and
   deposit branches; because sign conventions differ by account class, positive rows can count
   toward either goal. `maintaining_balance` reads today's balance (not a high-water mark) and
   `is_completed` is never reset to `false` (the function only walks open promotions).
7. **[confirmed] Promotion recalc trigger cost.** One `SECURITY DEFINER` PL/pgSQL call per
   `account_transactions` row insert/update/delete; it early-exits only when the account has no
   open promotion. `SET search_path` is not pinned (hardening gap, consistent with older functions).
8. **[confirmed] `account_promotions` is not in `src/lib/database.types.ts`** and
   `promotion-actions.ts` uses `.select("*")`. It compiles only because the Supabase clients are
   untyped.
9. **[confirmed] `migrateAccountTypes()` is not transactional** and always writes
   `field_visibility: null` unless the new type is `other` (discards a previous custom config).
10. **[confirmed] Legacy accounts can stay bridged forever.** If the owner ignores the banner the
    account keeps a retired type, and `legacyCategoryVisibility()` keeps guessing from `category`
    (e.g. a retired "Cash" account gets the banking default with target/APY fields).
11. **[confirmed] Migration prefix collision:** `005_promotions_and_account_types.sql` and
    `005_storage.sql` share a number (both apply; ordering is lexicographic).
12. **[confirmed] `PromotionsTrackerCard` has no loading state** (`isLoading` is set but never
    read) and fetches through a server action on mount (no SSR), so the card flashes empty.
13. **[confirmed] Deleting a promotion has no confirmation step**
    (trash icon → `deleteAccountPromotion` immediately).
14. **[confirmed] Unused symbols** in touched files (`isLoading`, `transactions`,
    `isLoadingTransactions`, `formatFullCurrency`, `setAllowOverpayment`, `currentAccountClass`);
    `PromotionDialog` still casts `(val: any)`.
15. **[confirmed] `InsightsCard` internals remain `any`-typed** — it was mostly a line-ending
    change plus the `getFieldVisibility`/`isInvestment` fix; not refactored.
16. **[confirmed] No automated tests** anywhere, so all of the above is manual-only.
17. **[uncertain] `differenceInDays` uses raw milliseconds/floor**, so "days left" can be off by
    one across DST boundaries.
18. **[confirmed] Line-ending churn** inflates diffs (raw 1228/583 vs content 912/267) — do not
    "fix" this by reformatting.

---

## 7. Failed Approaches / Things Already Tried

- **PowerShell `Get-Content`/`Set-Content` round-trips (FAILED, data corruption).** Re-saving
  `AddAccountDialog.tsx` through those cmdlets mis-decoded UTF-8 emoji and mangled the
  Asset/Liability icons. Fixed by rewriting the bytes with .NET
  `[IO.File]::ReadAllText/WriteAllText(path, text, UTF8)` / the editor tool. Do not use the
  cmdlets on files containing emoji.
- **PowerShell "line surgery" on a source file (FAILED, emptied the file).** A scripted edit
  emptied `AddAccountDialog.tsx`; it was restored from `HEAD` and the changes re-applied by hand.
  Only use guarded, pre-checked, length-verified scripts (or just the editor tool).
- **Name-based field visibility (ABANDONED).** The branch initially called
  `getFieldVisibility(category, name)` and matched type names. Renames silently changed behaviour,
  so it was replaced by `code`-based presets. Do not reintroduce name matching.
- **`category`-only dispatch (INSUFFICIENT).** Cannot separate the pairs listed in §5.
- **JS-side promotion progress recalculation (ABANDONED).** Replaced by the DB function +
  trigger because edit/delete paths and the mock/real divergence caused stale progress.
  (Exact failure details from the earlier session are not in context — mark as uncertain.)
- **Custom account-type creation (REMOVED, by design).** Keeping the combobox "Create" path made
  the "8 types cover all" invariant unenforceable.
- **Trusting `.agents/scratch/memories/session-context.md` at face value (FAILED).** That file
  records an earlier state; several of its "Open Items" (Pay Remaining ignoring its amount, no
  `defaultAmount` prop, name-based `isInvestmentAccount`, missing promotion `GRANT`,
  creatable custom types) are **already fixed** in the working tree. Re-check code before acting
  on those notes.
- **Comparing raw `git diff --stat` runs across time (MISLEADING).** Large apparent changes appear
  and disappear because files are concurrently re-saved with LF↔CRLF differences. Use
  `git diff --stat --ignore-cr-at-eol` for content, and re-check `git status` before drawing
  conclusions.

---

## 8. Next Steps

### Required (do these first)

1. **Fix the Pay Remaining default source** so it cannot equal the destination (e.g. pass a
   distinct `defaultFromAccountId`, or leave the source as `"none"` and require an explicit
   choice). Verify a partial and a full payoff produce exactly one transfer row + two account
   transactions.
2. **Browser QA** (none has happened yet). Minimum pass:
   - mock mode (`bun run dev:mock`): all 8 types in Add account; presets per type; "Other"
     configurator toggles and persists; account detail cards render; promotions CRUD + progress;
     Pay Remaining opens a valid transfer.
   - dev DB: run migration 006 again (idempotency), confirm no duplicate types, confirm legacy
     types stay retired, then exercise the guided migration banner/dialog with a legacy account.
   - 375px and 1440px for every screen you touched.
3. **Settle the debt formula** (`calculateAccountStanding`). Write down the intended definition of
   "Total Accumulated Debt / Payments Made / Remaining Debt" per liability type, validate against a
   real credit-card and loan statement, then either fix the JS or move the calculation into SQL
   (consistent with the promotions decision). Consider loading transactions into the dialogs so
   all surfaces agree.
4. **Decide on server-side cap enforcement.** Either re-validate inside
   `createUnifiedTransaction` / `updateUnifiedTransaction` / account-transaction actions (preferred
   for correctness), or explicitly document that caps are advisory and client-side.
5. **Review the promotion threshold SQL** (`OR amount > 0` overlap) and the
   `maintaining_balance`/`is_completed` semantics; fix or document.
6. **Regenerate + re-verify migrations**: `bun run db:migrate` from root, then have the owner apply
   `supabase/generated/production-safe-update.sql` to production **after** the PR merges.
7. **Clean the unused symbols** introduced in touched files (§6 item 14).
8. **Commit + PR when the user asks** (not before). Suggested conventional commit:
   `feat(balancesheet): balance verification, promotions and core account types`, with a
   functional + file-change description as required by the PR template workflow.

### Optional improvements

- Loading state for `PromotionsTrackerCard`; confirmation dialog before deleting a promotion.
- Persist/audit the Allow Overpayment override.
- Update `src/lib/database.types.ts` (or parameterise the Supabase clients) for real type safety.
- Remove the remaining `any` casts in `InsightsCard` / `PromotionDialog`.
- Extract sub-components from `UnifiedTransactionDialog` / `AddAccountDialog` while you are in them.
- Give promotions a unit-test story (SQL assertions) even though the repo has no test runner.

### Ideas for later (explicitly not this PR)

- Delete the `TODO(#99-cleanup)` scaffolding (migration notice, dialog, migration actions, legacy
  `legacyCategoryVisibility` bridge) once no `account_types` row has `code IS NULL`.
- Bank-statement import as the real source of truth for balances/debt (spec: out of scope).
- Automated recurring transfers (branch #100).
- Social finance / split bills (`docs/social-finance-spec.md`).
- Promotion reward valuation (points → dollar value) and reminder notifications.

---

## 9. Relevant Files to Inspect First

| File | Why |
| ---- | --- |
| `docs/99-balance-verification-spec.md` | The authoritative feature spec: type model, migration strategy, debt rules, promotion design, verification plan |
| `AGENTS.md` | Durable commands, conventions and non-negotiables |
| `src/app/balancesheet/field-visibility.ts` | Core of the type→fields resolution, including the temporary legacy bridge |
| `src/app/balancesheet/types.ts` | `AccountTypeCode`, `AccountCategory`, `AccountFieldConfig`, promotion + migration types |
| `src/lib/account-validation-utils.ts` | The debt/standing math that needs review (highest-risk code) |
| `src/app/balancesheet/accountdetail/[id]/AccountDetailClient.tsx` | Mounts the standing + promotions cards and wires Pay Remaining (the source==destination bug lives here) |
| `src/components/dialogs/UnifiedTransactionDialog.tsx` | Transfer tab, `defaultAmount`/`defaultFromAccountId` handling, client caps + overpayment opt-in |
| `src/lib/actions/unified-transaction-actions.ts` | Server-side transfer/normal transaction writes; no cap re-validation |
| `src/lib/actions/promotion-actions.ts` | Promotion CRUD + `refreshAccountPromotions()` RPC + mock store |
| `supabase/migrations/006_core_account_types_and_promotion_progress.sql` | Retirement, `code`, `field_visibility`, promotion function/trigger/backfill |
| `supabase/migrations/005_promotions_and_account_types.sql` | `account_promotions` table, `recurring_transfers` guard |
| `src/app/balancesheet/actions.ts` | `getAccountTypes`, migration actions, mock branches, account CRUD |
| `src/app/balancesheet/components/AccountTypeMigrationDialog.tsx` + `AccountTypeMigrationNotice.tsx` + `AccountFieldConfigurator.tsx` | Guided migration UI + "Other" configuration (all marked `TODO(#99-cleanup)`) |
| `src/app/balancesheet/accountdetail/[id]/components/AccountStandingCard.tsx` | The only surface that computes standing with real transactions |
| `src/app/balancesheet/accountdetail/[id]/components/PromotionsTrackerCard.tsx` | Promotion progress UI + toggle/delete |
| `src/mock-data/balancesheet.ts` | Mock-mode mirror of the new model |
| `src/app/allocations/actions.ts` | Month-aware mock allocation store |
| `.context/memories/{architecture,decisions,domain}.md` | Long-term memory; ADR-002 and ADR-003 are directly relevant |
| `.agents/scratch/memories/session-context.md` | Short-term notes — **stale**, see §7 |

---

## 10. Commands / Verification

### Verify the current state (as at this snapshot)

```powershell
git status --porcelain=v1
git --no-pager diff --stat --ignore-cr-at-eol   # content-only diff; EOL churn inflates the raw stat
cd src
bunx tsc --noEmit          # expect exit 0
bun run build              # expect exit 0
```

Optional dead-code report (informational, not a gate — repo is not clean):

```powershell
cd src
bunx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false 2>&1 |
  Out-File -Encoding utf8 $env:TEMP\pholio-unused.txt
Select-String -Path $env:TEMP\pholio-unused.txt -Pattern 'error TS(6133|6196|6192)'
```

### Verify future changes

1. `cd src && bunx tsc --noEmit` and `cd src && bun run build` must both exit 0 (this is the CI
   gate too).
2. Run the app in mock mode for fast UI checks:
   `cd src && bun run dev:mock` → http://localhost:3000.
3. For DB-backed checks use `cd src && bun run dev` with a valid `src/.env.local`.
4. Migration idempotency: `bun run db:migrate` from root, then re-run the generated SQL against
   the dev database and assert there are no duplicate `account_types` rows and that legacy rows
   are still `is_active = false`.
5. Promotion progress: create a promotion on an account, add/edit/delete `account_transactions`
   inside its window, and confirm `current_amount` / `is_completed` follow.
6. Pay Remaining: from the liability account detail page, verify the dialog opens on the transfer
   tab with the debt amount pre-filled **and a different source account**, and that submitting
   creates one transfer + two account transactions.
7. Responsiveness: 375px and 1440px (browser dev tools) for every touched screen.

### Migrations (reminder)

```powershell
bun run db:migrate        # root; writes supabase/generated/*.sql only
# owner then pastes supabase/generated/production-safe-update.sql into the Supabase SQL editor
```

---

## 11. Git State (as at this snapshot)

### Branch and position

- **Current branch:** `99-feature-balance-verification-and-debt-tracking-for-non-investment-accounts`
- **HEAD:** `55a997f` — “update-browserslist-db@latest” (2026-09-16)
- **Upstream:** `origin/99-…` is at `bd9fec1` — “Clean up unused imports” (2026-09-08), so the local
  branch is **1 commit ahead** of the remote.
- **Base release:** tag `v1.12.0` (`8e30156`), which contains `feat: Transfer tab with dual-account
  selection (#119)` (`125a945`).

Recent local history (newest first):

| Commit | Message | Notes |
| ------ | ------- | ----- |
| `55a997f` | `update-browserslist-db@latest` | current HEAD |
| `bd9fec1` | `Clean up unused imports` | pushed (origin HEAD) |
| `cb3097f` | `fix: autofill based off historical` | pushed; added `autocomplete-input.tsx` + `getTransactionDescriptions()` |
| `8e30156` | `chore(release): 1.12.0 [skip ci]` | tag `v1.12.0` |
| `125a945` | `feat: Transfer tab with dual-account selection (#119)` | transfer tab + shared dialog groundwork |

### Uncommitted work (⚠️ do not discard)

**27 modified tracked feature files** (plus `AGENTS.md`, which this handoff updated — so
`git status` currently shows 28 modified files). Content diff of the feature work:
**912 insertions / 267 deletions** (`--ignore-cr-at-eol`); the raw stat is **1228 / 583**
because of LF↔CRLF churn. Files:

- `.context/memories/architecture.md`, `decisions.md`, `domain.md`
- `src/app/allocations/actions.ts`, `src/app/allocations/components/TransactionDialog.tsx`
- `src/app/balancesheet/actions.ts`, `client.tsx`, `page.tsx`, `field-visibility.ts`, `types.ts`
- `src/app/balancesheet/components/AccountCard.tsx`, `AddAccountDialog.tsx`,
  `components/account-detail/AccountStats.tsx`
- `src/app/balancesheet/accountdetail/[id]/AccountDetailClient.tsx` and its `components/`
  (`AssetPerformance.tsx`, `BalanceCard.tsx`, `EditAccountDialog.tsx`, `InsightsCard.tsx`)
- `src/app/recurring/components/edit-recurring-dialog.tsx`
- `src/components/dialogs/ManagePresetsDialog.tsx`, `src/components/dialogs/UnifiedTransactionDialog.tsx`
- `src/components/ui/autocomplete-input.tsx`
- `src/lib/account-utils.ts`, `src/lib/actions/unified-transaction-actions.ts`, `src/lib/date-utils.ts`
- `src/mock-data/balancesheet.ts`
- `supabase/migrations/003_budgeting.sql`

**12 untracked files** (all part of this feature — none may be lost):

- `docs/99-balance-verification-spec.md`
- `src/lib/account-validation-utils.ts`, `src/lib/sort-utils.ts`,
  `src/lib/actions/promotion-actions.ts`
- `src/app/balancesheet/components/AccountFieldConfigurator.tsx`,
  `AccountTypeMigrationDialog.tsx`, `AccountTypeMigrationNotice.tsx`
- `src/app/balancesheet/accountdetail/[id]/components/AccountStandingCard.tsx`,
  `PromotionDialog.tsx`, `PromotionsTrackerCard.tsx`
- `supabase/migrations/005_promotions_and_account_types.sql`,
  `supabase/migrations/006_core_account_types_and_promotion_progress.sql`

### Notes

- **Documentation added/updated by this handoff:** `AGENTS.md` was rewritten (shows as `M`) and
  `OPENCode_HANDOFF.md` was created (shows as untracked `??`). Both are documentation-only changes
  with no application/source code impact.
- **No commit, stage, stash, reset, push or PR was performed** by Cline during this handoff.
  The entire #99 implementation exists only in the working tree (plus the two migrations, which
  are untracked).
- Gitignored but present locally and relevant: `supabase/generated/combined-migrations.sql`,
  `supabase/generated/production-safe-update.sql` (both already include migration 006; regenerate
  before the production apply), `supabase/signing_keys.json`, `src/.env.local`, `src/.next`,
  `.agents/scratch/memories/session-context.md`.
- `git` prints `LF will be replaced by CRLF` warnings for several files; that is the known
  line-ending situation (§6 item 18), not a problem to fix.
- **Not verified from this environment:** whether migrations 005/006 are actually applied to the
  development database. Session notes say yes, dev only; production was not touched.

---

## How to Use This File

1. Read `AGENTS.md` for the durable rules, then this file for the current task.
2. Run the verification commands in §10 before changing anything, so you have a known-good baseline.
3. Start with the required next steps in §8 (the Pay Remaining bug is the highest-value fix).
4. When the branch is merged/abandoned, delete or rewrite this file — do not let it become stale
   documentation.