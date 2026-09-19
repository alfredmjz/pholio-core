# Long-Term Memory: Architectural Decision Records (ADR)

> **Storage Location**: `.context/memories/decisions.md` (Tracked in Repository)  
> **Purpose**: Documents major architectural decisions, subagent voting outcomes, and agreed-upon trade-offs.

---

## ADR-001: Project-Agnostic Agent Workflow & Voting Governance
- **Date**: 2026-08-22
- **Status**: Accepted
- **Context**: Needed a clear, predictable workflow for multi-agent collaboration with explicit task triage and subagent voting on complex features.
- **Decision**:
  1. Standardized a 6-agent hierarchy: `orchestrator`, `system-architect`, `ui-ux-designer`, `senior-engineer`, `code-reviewer`, `ui-flow-reviewer`.
  2. Implemented 3-tier task routing (Low, Medium, High). High-complexity tasks trigger multi-agent voting.
  3. Implemented dual memory management (In-repo long-term vs Gitignored short-term) evaluated per request.
- **Consequences**: Ensures clean execution paths, prevents premature implementation, and preserves long-term project context.

---

## ADR-002: 7 Core Account Types Replace the Legacy Type Catalogue

- **Date**: 2026-09-18
- **Status**: Accepted (product decision) — implementation details pending
- **Context**: `002_finance.sql` seeded 12 system account types (Checking Account, Cash, Emergency Fund, Investment/Brokerage/Tax-Advantaged/Retirement accounts, Personal Loan, …) and users can create **custom types** via the combobox in `AddAccountDialog` (`createAccountType` inserts `is_system: false` with a hardcoded `category: "other"`). Branch `99` introduces a 7-type model and rewrote `field-visibility.ts` to dispatch on the type **name**.
- **Decision**:
  1. The 7 core types **replace** the legacy catalogue — this is not an additive change.
  2. **No category/name fallbacks**: the seven types must cover every realistic account.
  3. The account type is selected from a **predetermined dropdown**; the type name is a display label only and is not a semantic source of truth.
  4. Migration of existing data must be **non-destructive** (see `architecture.md` → Data Safety & Migration Rules).
- **Consequences / Open work**:
  - Existing `accounts.account_type_id` values must be **remapped** to the closest core type; legacy and custom type rows are **retired** via `is_active = false` (never deleted — `accounts.account_type_id` is `ON DELETE RESTRICT`). `getAccountTypes()` already filters `is_active = true`.
  - The custom-type creation path must be removed from `AddAccountDialog` to preserve the invariant.
  - `getFieldVisibility()` may not rely on free-text names; a stable type identifier (proposed `account_types.code`) or the fixed seed names must be used to distinguish Chequing/Savings, Credit Card/Line of Credit, and Mortgage/Loans, which share categories.
  - `isInvestmentAccount()` must key off the account type/category, **not** the user-entered account name.

---

## ADR-003: Alphabetical Ordering for Dropdown Option Lists

- **Date**: 2026-09-18
- **Status**: Accepted
- **Context**: Option lists rendered in dialog dropdowns/comboboxes inherited whatever order the data arrived in (DB `sort_order`, creation order, API order), so the same list could appear in different orders between dialogs and was slow to scan.
- **Decision**:
  1. Option lists shown in dialog dropdowns/comboboxes are sorted alphabetically by the label the user reads, case-insensitively, using `src/lib/sort-utils.ts` (`sortAlphabetically`, `compareAlphabetically`). Leading emoji/symbols are ignored so "💰 Deposit" sorts under "D".
  2. Account selectors use `sortAccounts()` (`src/lib/account-utils.ts`), which now orders by the formatted display label ("Institution - Name" when applicable) so every account dropdown lists accounts identically.
  3. Covered lists: accounts, budget categories, transaction presets, account types, description-history suggestions.
  4. Hand-authored enums (transaction type, income source, promotion type, recurring bill/subscription) are written in alphabetical order in the source.
  5. **Documented exceptions** — orders that carry meaning and must not be alphabetised:
     - Recurrence units stay ascending: Days → Weeks → Months → Years.
     - `ServiceAutocomplete` keeps the logo.dev search relevance order, because it is a query-driven search result rather than a static list.
     - Chronological lists (`month-selector`) stay chronological.
- **Consequences**: Dropdowns become predictable and scannable. New option lists must be passed through `sortAlphabetically` instead of relying on data order.
