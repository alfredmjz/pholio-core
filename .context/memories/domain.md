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
