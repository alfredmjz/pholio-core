# Allocation Page Redesign Specification

**Status:** 🟡 IN PROGRESS
**Created:** 2024-12-04
**Last Updated:** 2024-12-04
**Owner:** Claude Code

## Overview

This document specifies a comprehensive redesign of the allocation page with a focus on:

1. Clear high-level and detailed budget overview
2. Month-by-month budget management
3. Transaction type awareness (recurring, loan, interest, etc.)
4. Full transaction record with advanced filtering/sorting
5. Template import for unallocated months

## Design Concept: "Financial Command Center"

The new design takes inspiration from modern finance apps (Mint, YNAB, Copilot) with a **dashboard-style layout** that provides both at-a-glance summaries and deep-dive capabilities.

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Month Navigation + Quick Actions                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  BUDGET HEALTH RING (Hero Section)                                   │   │
│  │  - Circular progress showing overall budget utilization              │   │
│  │  - Expected Income | Total Budget | Remaining in center              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐   │
│  │  SPENDING BY TYPE          │  │  CATEGORY BREAKDOWN                 │   │
│  │  - Recurring               │  │  - List of all categories           │   │
│  │  - One-time                │  │  - Progress bars                    │   │
│  │  - Loans                   │  │  - Quick edit                       │   │
│  │  - Subscriptions           │  │  - Expand for transactions          │   │
│  └────────────────────────────┘  └────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TRANSACTION LEDGER                                                  │   │
│  │  - Full transaction list for the month                               │   │
│  │  - Sort by: Date, Name, Amount, Category, Type                       │   │
│  │  - Filter by: Category, Type, Date Range, Amount Range               │   │
│  │  - Search functionality                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Progress

| Phase | Task                                  | Status      |
| ----- | ------------------------------------- | ----------- |
| 1     | Create spec document                  | ✅ Complete |
| 2     | Create new client component structure | 📋 Pending  |
| 3     | Implement BudgetHealthRing component  | 📋 Pending  |
| 4     | Implement SpendingByType panel        | 📋 Pending  |
| 5     | Implement CategoryBreakdown panel     | 📋 Pending  |
| 6     | Implement TransactionLedger component | 📋 Pending  |
| 7     | Implement TemplateImportDialog        | 📋 Pending  |
| 8     | Test and verify                       | 📋 Pending  |

## Component Specifications

### 1. Header Section (Reuses MonthSelector)

**Existing:** MonthSelector component - kept as-is
**New additions:**

- "Use Template" button (shown when month has no allocations)
- Settings/options menu

### 2. BudgetHealthRing Component

**Purpose:** Visual at-a-glance health indicator for the month's budget

**Features:**

- Large circular progress ring (SVG-based)
- Shows overall utilization percentage
- Color-coded: Green (<80%), Yellow (80-100%), Red (>100%)
- Center displays:
  - Expected Income (top)
  - Remaining amount (middle, large)
  - "of $X budget" (bottom)
- Animated on load

**Props:**

```typescript
interface BudgetHealthRingProps {
	expectedIncome: number;
	totalBudget: number;
	totalSpent: number;
	unallocated: number;
}
```

### 3. SpendingByType Component

**Purpose:** Break down spending by transaction type

**Transaction Types (UI only for now):**

- 🔄 **Recurring** - Regular monthly expenses (rent, utilities)
- 💳 **One-time** - Single purchases
- 🏦 **Loans** - Loan payments (principal + interest)
- 📱 **Subscriptions** - App/service subscriptions
- 💰 **Interest** - Interest payments
- 📈 **Investments** - Investment contributions

**Features:**

- Compact horizontal bar chart
- Shows amount per type
- Click to filter transactions
- Uses Notion color palette for type badges

**Props:**

```typescript
interface SpendingByTypeProps {
	transactions: Transaction[];
	onTypeFilter: (type: string | null) => void;
	activeFilter: string | null;
}
```

### 4. CategoryBreakdown Component (Enhanced CategoryCard list)

**Purpose:** Detailed view of each budget category

**Features:**

- Collapsible category rows
- Inline budget editing (existing)
- Progress bar with gradient based on utilization
- Shows: Category name, Budget, Spent, Remaining, % Used
- Expand to show transactions for that category
- Transaction count badge
- Type indicator badges (recurring, etc.)
- Drag-to-reorder (future)

**Layout:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🏠 Housing                                    $1,200 / $1,500  80%  │
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ [Recurring] [3 transactions]                          $300 left ▼  │
├──────────────────────────────────────────────────────────────────────┤
│   Dec 1   Rent Payment               🔄 Recurring      $1,000.00   │
│   Dec 5   Electric Bill              🔄 Recurring        $150.00   │
│   Dec 10  Water Bill                 🔄 Recurring         $50.00   │
└──────────────────────────────────────────────────────────────────────┘
```

### 5. TransactionLedger Component (Enhanced TransactionsTable)

**Purpose:** Complete transaction record with advanced filtering

**Features:**

- All existing functionality (search, sort)
- **New filters:**
  - Transaction type dropdown
  - Date range picker (within month)
  - Amount range (min/max)
- **New columns:**
  - Type indicator icon
  - Notes preview (hover tooltip)
- Row hover actions: Edit, Delete, Recategorize
- Bulk selection for actions
- Export selected (future)

**Sort options:** Date, Name, Amount, Category, Type

**Filter state:**

```typescript
interface TransactionFilters {
	search: string;
	category: string | "all";
	type: TransactionType | "all";
	dateRange: { start: Date | null; end: Date | null };
	amountRange: { min: number | null; max: number | null };
}
```

### 6. TemplateImportDialog Component

**Purpose:** Import budget templates for unallocated months

**Trigger:** Shown when navigating to a month with no allocation

**Options:**

1. **Import from previous month** - Copy categories and amounts from last allocated month
2. **Use saved template** - Select from user's saved templates
3. **Start fresh** - Create empty allocation with just expected income

**UI:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Set Up December 2024                                           X  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  This month doesn't have a budget yet. How would you like to       │
│  get started?                                                       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  📋 Import from November 2024                                  │ │
│  │  Copy all 8 categories ($4,500 total budget)                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  📁 Use a Template                                             │ │
│  │  Select from your saved budget templates                       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ✨ Start Fresh                                                │ │
│  │  Create a new budget from scratch                              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Expected Income for December: $________                           │
│                                                        [Continue]   │
└─────────────────────────────────────────────────────────────────────┘
```

## Transaction Types (New Concept)

Since transaction types don't exist in the current schema, we'll add UI for them:

```typescript
type TransactionType =
	| "recurring" // Monthly recurring (rent, utilities)
	| "one_time" // Single purchase
	| "loan" // Loan payment
	| "subscription" // App/service subscription
	| "interest" // Interest payment
	| "investment" // Investment contribution
	| "income" // Income received
	| "transfer"; // Internal transfer

// For UI purposes, map to icons and colors
const TRANSACTION_TYPE_CONFIG = {
	recurring: { icon: "RefreshCw", color: "blue", label: "Recurring" },
	one_time: { icon: "CreditCard", color: "gray", label: "One-time" },
	loan: { icon: "Landmark", color: "orange", label: "Loan" },
	subscription: { icon: "Smartphone", color: "purple", label: "Subscription" },
	interest: { icon: "Percent", color: "red", label: "Interest" },
	investment: { icon: "TrendingUp", color: "green", label: "Investment" },
	income: { icon: "DollarSign", color: "green", label: "Income" },
	transfer: { icon: "ArrowLeftRight", color: "gray", label: "Transfer" },
};
```

## Color Scheme (From Tailwind Config)

Using the existing Notion-inspired palette:

- **Success/Under budget:** `bg-success` / green
- **Warning/Near budget:** `bg-warning` / yellow
- **Error/Over budget:** `bg-error` / red
- **Info/Neutral:** `bg-info` / blue
- **Muted/Secondary:** `bg-muted` / gray

## File Structure

```
src/app/allocations/
├── page.tsx                    # Server component (unchanged)
├── client.tsx                  # Original client (keep for now)
├── client-v2.tsx               # NEW: Redesigned client component
├── types.ts                    # Add TransactionType
├── actions.ts                  # Unchanged
├── context/
│   └── AllocationContext.tsx   # Unchanged
└── components/
    ├── MonthSelector.tsx       # Unchanged
    ├── SummaryCard.tsx         # Keep for reference
    ├── CategoryCard.tsx        # Keep for reference
    ├── TransactionsTable.tsx   # Keep for reference
    ├── AddCategoryDialog.tsx   # Reuse
    ├── DeleteCategoryDialog.tsx# Reuse
    ├── v2/                     # NEW: V2 components
    │   ├── BudgetHealthRing.tsx
    │   ├── SpendingByType.tsx
    │   ├── CategoryBreakdown.tsx
    │   ├── CategoryRow.tsx
    │   ├── TransactionLedger.tsx
    │   ├── TransactionFilters.tsx
    │   └── TemplateImportDialog.tsx
    └── shared/
        └── TransactionTypeIcon.tsx
```

## Testing Checklist

- [ ] Budget health ring displays correctly
- [ ] Spending by type shows accurate breakdown
- [ ] Category breakdown is collapsible
- [ ] Transaction ledger filters work
- [ ] Sort functionality works
- [ ] Template import dialog appears for empty months
- [ ] Responsive on mobile/tablet
- [ ] Dark mode compatible
- [ ] Accessibility verified

## Notes

- This is a UI-only change - existing functionality preserved
- Transaction types are UI placeholders until schema is updated
- Template import will show UI but may not be fully functional
- All components use existing design tokens and patterns
