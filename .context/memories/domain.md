# Long-Term Memory: Domain Knowledge & Rules

> **Storage Location**: `.context/memories/domain.md` (Tracked in Repository)  
> **Purpose**: Stores project domain models, business logic guidelines, and core domain concepts.

---

## Business Domain Overview
- **Domain**: Personal Finance & Budget Tracking Application (Pholio).
- **Core Entities**: Users, Accounts, Transactions, Allocations, Categories, Recurring Rules, Presets.

---

## Domain Rules & Constraints
- **Multi-Tenancy & Privacy**: Every financial record must strictly belong to an authenticated user (`user_id`). No cross-tenant data leaks.
- **Guest Migration Path**: Supports guest accounts with seamless upgrade capabilities to full accounts without data loss.
- **Data Precision**: Financial amounts and currency values must maintain exact decimal precision.

---

## Account Types — 7 Core Model (Decision 2026-09-18)

The account type catalogue is being **replaced** by seven core types. The type name is a display label for the user; the type itself is chosen from a predetermined dropdown at account creation.

| Type | Class | Category | Key tracked fields |
| ---- | ----- | -------- | ------------------ |
| Chequing | asset | banking | balance |
| Savings | asset | banking | balance, interest/APY, target balance |
| Investment | asset | investment | balance, contribution room (covers tax-advantaged & retirement) |
| Credit Card | liability | credit | balance, credit limit, APR, payment due date |
| Line of Credit | liability | credit | balance, credit limit, variable APR (no due date) |
| Mortgage | liability | debt | original amount, rate, loan term, due date |
| Loans | liability | debt | original amount, APR, loan term, due date (auto/student/personal) |

**Rules**
- Every account has exactly one type; `class` (asset/liability) is derived from the type.
- Investment accounts are **exempt** from debt/cash-balance validation and instead track contribution room.
- Liability accounts track **Total Accumulated Debt**, **Payments Made**, and **Remaining Debt**; payments/withdrawals are capped by remaining debt, asset withdrawals by available balance.
- Transactions affect an account's debt/balance **only when the transaction is tagged to that account**.
- `Pay Remaining` settles the outstanding debt of a liability account, partially or in full, and is **recorded as a transfer from a source account to the liability account**.

## Promotions / Welcome Bonuses (Decision 2026-09-18)

- A promotion belongs to one account and tracks a reward goal with `promotion_type` ∈ `spend_threshold | deposit_threshold | maintaining_balance`, a `target_amount`, a `reward_description`, and a start/end date window.
- Progress is derived from the account's transactions within the window (spend/deposit) or from the account's current balance (maintaining balance), and `is_completed` flips once the target is met.
- Ideal future source of truth is the account's **monthly statement** (bank-institution integration is not yet implemented).
