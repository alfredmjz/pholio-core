# Social Finance Feature Specification

**Status:** Planning
**Created:** 2025-12-14
**Author:** Antigravity (Agent)
**Related Goals:** "Track money owe/owed", "Split bill", "Trip allowance"

## Quick Context
Users need to track informal debts ("I owe Bob $20") and manage group spending for events like Trips. This feature introduces social elements to the personal finance tracker.

## Problem Statement
Currently, Pholio only tracks *personal* income and expenses. It lacks a way to:
1.  Record money lent to or borrowed from friends.
2.  Split a transaction (e.g., a dinner bill) where the user pays the full amount but expects reimbursement.
3.  Track spending against a specific separate "event" budget (like a Trip).

## Design Decisions

### 1. Hybrid "Friend" Model
We need to track debts with people who may NOT be users of the app.
-   **Decision:** We will use a "Contacts" concept (just a name initially) stored on the `debt` record or a light-weight `social_contacts` table.
-   **For MVP:** Debts will simply store a `person_name` (string) for flexibility. Future iterations can link to real User IDs.

### 2. "Trip" as a Container
-   **Decision:** Create a `social_events` (or `trips`) table that acts as a folder for debts/expenses.
-   **Why:** Allows grouping "All expenses for Paris Trip" to see total cost vs allowance.

### 3. Debt vs Expense
-   **Decision:** We will introduce a `debts` table.
    -   When splitting a bill: You create a Transaction (Expense: -$100). You also create a Debt (Income potential: +$50 from Bob).
    -   Net effect on your net worth: -$50 (once Bob pays).

## Implementation Guide

### Phase 1: Database Schema
**File:** `supabase/migrations/20251214_social_finance.sql`

1.  **`social_contacts`** (Optional, maybe just strings for now? Let's go with strings for MVP velocity).
    -   *Actually, let's create a table to avoid typing "Bob" 50 times.*
    -   `id`, `user_id` (owner), `name`, `linked_user_id` (optional).

2.  **`debts`**
    -   `id`
    -   `user_id` (owner)
    -   `contact_name` (or link to contact)
    -   `amount` (Positive = They owe Me. Negative = I owe Them).
    -   `currency`
    -   `description`
    -   `due_date`
    -   `is_settled` (boolean)
    -   `event_id` (optional FK to trips)

3.  **`social_events`** (Trips)
    -   `id`, `user_id`
    -   `name`
    -   `budget` (Allowance)
    -   `start_date`, `end_date`

### Phase 2: Server Actions
**File:** `src/app/social/actions.ts`
-   `createDebt(data)`
-   `settleDebt(id)`
-   `getDebts()`
-   `getSocialEvents()`

### Phase 3: UI Implementation
-   **Page:** `src/app/social/page.tsx` (Dashboard)
    -   Tabs: "Debts" | "Events/Trips"
-   **Components:**
    -   `DebtList` (Grouped by Person)
    -   `CreateDebtDialog` (Split bill interface)
    -   `EventCard` (Progress bar for Trip budget)

## Testing Checklist
-   [ ] Create a debt (I owe Bob).
-   [ ] Create a credit (Bob owes me).
-   [ ] Mark as settled.
-   [ ] Create a Trip with budget.
-   [ ] Add expense to Trip.
-   [ ] Verify Trip budget progress.

## Success Criteria
-   ✅ User can see a net "Social Balance" (e.g. "You are owed $150 total").
-   ✅ User can track expenses for a specific Trip.
