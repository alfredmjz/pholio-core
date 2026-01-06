# Pholio Developer Reference

> **Version**: 1.2.2 | **Last Updated**: January 2026

### Index

- [Quick Start](#quick-start)
- [Scripts](#1-scripts)
- [Server Actions](#2-server-actions)
- [API Endpoints](#3-api-endpoints)
- [React Hooks](#4-react-hooks)
- [Utilities](#5-utilities)
- [Components](#6-components)
- [Types](#7-types)
- [Database Migrations](#database-migrations)

---

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Create `src/.env.local` with:

```env
# Local Supabase (Docker)
LOCAL_SUPABASE_URL=http://host.docker.internal:54321
LOCAL_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
LOCAL_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Supabase API
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

# Resend (SMTP)
RESEND_API_KEY=...

# Logo API
NEXT_PUBLIC_LOGO_DEV_TOKEN=pk_...
LOGO_DEV_SECRET_KEY=sk_...
```

Run `src/scripts/generate-es256-keys.ts` to generate JWT keys.

### 3. Setup Database

```bash
cd src && bun run db:migrate
```

Apply generated SQL in Supabase Dashboard → SQL Editor.

### 4. Development

```bash
cd src
bun run dev          # Start with real data
bun run dev:mock     # Start with mock data
```

Visit http://localhost:3000

---

## 1. Scripts

### Root (`package.json`)

| Script                  | Description             |
| ----------------------- | ----------------------- |
| `bun run start`         | Start Docker containers |
| `bun run build`         | Build Docker containers |
| `bun run clean-rebuild` | Rebuild without cache   |
| `bun run down`          | Stop containers         |
| `bun run logs`          | Follow container logs   |
| `bun run db:migrate`    | Run database migrations |

### Source (`src/package.json`)

| Script             | Description                  |
| ------------------ | ---------------------------- |
| `bun run dev`      | Start dev server             |
| `bun run build`    | Build for production         |
| `bun run start`    | Start production server      |
| `bun run dev:mock` | Dev with sample data (no DB) |

---

## 2. Server Actions

### Authentication

**File:** `src/app/(auth-pages)/login/actions.ts`

| Function                         | Description                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `login(formData)`                | Authenticate with email/password. Requires email verification. Returns `{showWelcome}` on first login. |
| `signup(formData)`               | Register new account. Sends verification email. Returns `{success, redirectUrl}` or `{error}`.         |
| `resendConfirmationEmail(email)` | Resend verification email for expired links.                                                           |
| `loginAsGuest()`                 | Create anonymous guest session with random name.                                                       |
| `signOut()`                      | Sign out and redirect to login.                                                                        |

**File:** `src/app/(auth-pages)/forgot-password/actions.ts`

| Function                   | Description                        |
| -------------------------- | ---------------------------------- |
| `forgotPassword(formData)` | Send password reset link to email. |

**File:** `src/app/(auth-pages)/reset-password/actions.ts`

| Function                  | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `resetPassword(formData)` | Set new password. Validates password match. Redirects to dashboard. |

---

### Unified Transactions

**File:** `src/lib/actions/unified-transaction-actions.ts`

Creates transactions that update **both** budget allocations and account balances atomically.

| Function                                     | Description                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `createUnifiedTransaction(input)`            | Create transaction updating both budget and account. Handles rollback on failure. |
| `getSuggestedAccountForCategory(categoryId)` | Get linked account for savings_goal or debt_payment categories.                   |
| `getAccountsForSelector()`                   | Get all active accounts for dropdown selection.                                   |

---

### Allocations

**File:** `src/app/allocations/actions.ts`

#### Allocation Management

| Function                                                                 | Description                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `getAllocation(year, month)`                                             | Check if allocation exists. Returns `null` if not found.                                   |
| `getOrCreateAllocation(year, month, expectedIncome?)`                    | Get or create allocation for month.                                                        |
| `getAllocationSummary(allocationId)`                                     | Get allocation with categories and computed fields (actual_spend, remaining, utilization). |
| `getPreviousMonthSummary(year, month)`                                   | Get previous month for import preview.                                                     |
| `importPreviousMonthCategories(targetYear, targetMonth, expectedIncome)` | Copy categories from previous month. Does NOT copy transactions.                           |
| `updateExpectedIncome(allocationId, expectedIncome)`                     | Update expected income.                                                                    |
| `syncRecurringExpenses(allocationId, userId, targetMonth)`               | Sync recurring expenses to categories.                                                     |

#### Category Management

| Function                                                                     | Description                 |
| ---------------------------------------------------------------------------- | --------------------------- |
| `createCategory(allocationId, name, budgetCap, isRecurring?, displayOrder?)` | Create budget category.     |
| `updateCategoryBudget(categoryId, budgetCap)`                                | Update budget cap.          |
| `updateCategoryName(categoryId, name)`                                       | Update name.                |
| `deleteCategory(categoryId)`                                                 | Delete category.            |
| `reorderCategories(categoryOrders)`                                          | Batch update display_order. |

#### Transaction Management

| Function                                                                       | Description                                                      |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `getTransactionsForMonth(year, month)`                                         | Get transactions with category names.                            |
| `createTransaction(name, amount, transactionDate, categoryId?, type?, notes?)` | Create transaction. Handles savings_goal and debt_payment types. |
| `updateTransaction(transactionId, data)`                                       | Update transaction fields.                                       |
| `updateTransactionCategory(transactionId, categoryId)`                         | Update category only.                                            |
| `deleteTransaction(transactionId)`                                             | Delete transaction.                                              |

#### Templates

| Function                                                                 | Description                  |
| ------------------------------------------------------------------------ | ---------------------------- |
| `getUserTemplates()`                                                     | Get all user templates.      |
| `applyTemplateToAllocation(templateId, allocationId)`                    | Apply template categories.   |
| `createTemplateFromAllocation(allocationId, templateName, description?)` | Save allocation as template. |

---

### Balance Sheet

**File:** `src/app/balancesheet/actions.ts`

#### Account Types & Accounts

| Function                   | Description                               |
| -------------------------- | ----------------------------------------- |
| `getAccountTypes()`        | Get system + custom account types.        |
| `createAccountType(input)` | Create custom account type.               |
| `getAccounts()`            | Get all active accounts with types.       |
| `getAccountById(id)`       | Get single account.                       |
| `getBalanceSheetSummary()` | Get totals, net worth, 30-day history.    |
| `createAccount(input)`     | Create account.                           |
| `updateAccount(id, input)` | Update account. Triggers balance history. |
| `deleteAccount(id)`        | Soft delete (is_active = false).          |

#### Transactions & History

| Function                                    | Description                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `recordTransaction(input)`                  | Record transaction and update balance. Types: deposit, withdrawal, interest, payment, adjustment, contribution, transfer. |
| `getAccountTransactions(accountId, limit?)` | Get account transactions. Default: 50.                                                                                    |
| `getAccountHistory(accountId, limit?)`      | Get balance history. Default: 30 days.                                                                                    |
| `applyMonthlyInterest(accountId)`           | Apply interest based on rate and type.                                                                                    |

---

### Dashboard

**File:** `src/app/dashboard/actions.ts`

| Function                        | Description                                                         |
| ------------------------------- | ------------------------------------------------------------------- |
| `getDashboardData()`            | Get all dashboard data: metrics, net worth, cashflow, transactions. |
| `getCashflowData(period)`       | Get cashflow for "month", "quarter", or "year".                     |
| `getNetWorthData()`             | Get net worth breakdown with 30-day trend.                          |
| `getRecentTransactions(limit?)` | Get recent transactions. Default: 10.                               |

---

### Recurring Expenses

**File:** `src/app/recurring/actions.ts`

| Function                              | Description                                                          |
| ------------------------------------- | -------------------------------------------------------------------- |
| `getRecurringExpenses()`              | Get all with computed status (paid/partial/unpaid/overdue/upcoming). |
| `addRecurringExpense(expense)`        | Add recurring expense.                                               |
| `toggleSubscription(id, isActive)`    | Toggle active status.                                                |
| `updateRecurringExpense(id, updates)` | Update fields.                                                       |
| `deleteRecurringExpense(id)`          | Delete expense.                                                      |

---

### Settings

**File:** `src/app/settings/actions.ts`

| Function                             | Description                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `updateProfile(formData)`            | Update full_name.                                                             |
| `changePassword(formData)`           | Change password. Validates current password.                                  |
| `changeEmail(formData)`              | Change email. Sends verification.                                             |
| `uploadProfileAvatar(formData)`      | Upload avatar with crop params.                                               |
| `getAllocationSettings()`            | Get allocation preferences.                                                   |
| `updateAllocationSettings(settings)` | Update preferences: newMonthDefault ("blank", "import_previous", "template"). |

---

## 3. API Endpoints

### POST /api/auth/users/signup

Register new user.

**Request:**

```json
{
	"email": "user@example.com",
	"password": "securepassword123",
	"fullName": "John Doe"
}
```

**Response (201):**

```json
{
	"success": true,
	"message": "User registered successfully",
	"user": { "id": "uuid", "email": "user@example.com" }
}
```

---

### GET /api/auth/users/profile

Get authenticated user profile. Requires session cookie.

**Response (200):**

```json
{
	"profile": {
		"id": "uuid",
		"email": "user@example.com",
		"full_name": "John Doe",
		"avatar_url": "https://...",
		"is_guest": false,
		"has_seen_welcome": true
	}
}
```

---

### PATCH /api/auth/users/profile

Update profile. Requires session cookie.

**Request:**

```json
{
	"fullName": "Jane Doe",
	"avatarUrl": "https://..."
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "profile": { ... }
}
```

---

### POST /api/auth/users/guest/convert

Convert guest account to registered account.

**Request:**

```json
{
	"email": "user@example.com",
	"password": "newpassword123",
	"fullName": "John Doe"
}
```

**Response (200):**

```json
{
	"success": true,
	"message": "Account successfully upgraded to registered user"
}
```

---

### POST /api/google/export

Export transactions to Google Sheets. Requires Google OAuth token.

**Request (Date Range):**

```json
{
	"startDate": "2025-01-01",
	"endDate": "2025-01-31",
	"token": "google-oauth-token"
}
```

**Request (Month Range):**

```json
{
	"startYear": 2025,
	"startMonth": 1,
	"endYear": 2025,
	"endMonth": 1,
	"token": "google-oauth-token"
}
```

**Response (200):**

```json
{
	"url": "https://docs.google.com/spreadsheets/d/..."
}
```

---

### GET /api/logos/[domain]

Fetch service logo. Proxies to logo.dev with caching.

**Response:** Binary image data with headers:

- `Content-Type`: image/png or image/jpeg
- `X-Cache`: HIT or MISS

---

### GET /api/logos/search?q=query

Search for service logos.

**Response (200):**

```json
{
	"results": [
		{ "name": "Netflix", "domain": "netflix.com" },
		{ "name": "Spotify", "domain": "spotify.com" }
	]
}
```

---

### GET /auth/callback

OAuth callback handler. Exchanges code for session and redirects to `next` parameter.

---

## 4. React Hooks

### useAuthForm

**File:** `src/hooks/use-auth-form.ts`

Form handling with validation and toast notifications.

```typescript
const { handleSubmit, error, success, isLoading, setError } = useAuthForm({
	action: login,
	validate: (formData) => null, // Return error string or null
	onSuccess: (result) => {},
	successMessage: "Welcome!",
});
```

---

### useAllocationSync

**File:** `src/hooks/useAllocationSync.ts`

Supabase Realtime synchronization for allocation data.

```typescript
const {
	summary, // AllocationSummary | null
	transactions, // Transaction[]
	isConnected, // Realtime connection status
	isRefetching, // Data refreshing
	optimisticallyAddCategory, // (name, budgetCap) => tempId
	optimisticallyUpdateBudget, // (categoryId, newBudget) => void
	optimisticallyUpdateName, // (categoryId, newName) => void
	optimisticallyDeleteCategory, // (categoryId) => void
	rollback, // (previousSummary) => void
} = useAllocationSync(allocationId, year, month, initialSummary, initialTransactions);
```

---

### useOptimisticAllocation

**File:** `src/hooks/useOptimisticAllocation.ts`

Low-level optimistic updates. Used internally by useAllocationSync.

---

### useMobile

**File:** `src/hooks/use-mobile.ts`

```typescript
const isMobile = useMobile(); // true if viewport < 768px
```

---

## 5. Utilities

### Authentication

**File:** `src/lib/auth.ts`

| Function        | Description                                                                        |
| --------------- | ---------------------------------------------------------------------------------- |
| `requireAuth()` | Require auth. Redirects to /login if not authenticated. Returns `{user, profile}`. |
| `getAuth()`     | Get auth or null. No redirect.                                                     |
| `isGuestUser()` | Check if current user is guest.                                                    |

---

### Error Handling

**File:** `src/lib/errors.ts`

| Class                     | Status | Use Case               |
| ------------------------- | ------ | ---------------------- |
| `BadRequestError`         | 400    | Invalid request format |
| `UnauthorizedError`       | 401    | Not authenticated      |
| `ForbiddenError`          | 403    | No permission          |
| `NotFoundError`           | 404    | Resource missing       |
| `ConflictError`           | 409    | Already exists         |
| `ValidationError`         | 422    | Validation failed      |
| `InternalServerError`     | 500    | Server error           |
| `ServiceUnavailableError` | 503    | External service down  |

**Usage:**

```typescript
export const POST = asyncHandler(
	async (request) => {
		if (!body.email) throw new ValidationError("Email required");
		return Response.json({ success: true });
	},
	{ endpoint: "/api/example" }
);
```

---

### Redis Caching

**File:** `src/lib/redis.ts`

Uses Bun's native Redis. Falls back gracefully if unavailable.

| Function                               | Description                                  |
| -------------------------------------- | -------------------------------------------- |
| `cacheGet(key)`                        | Get cached value.                            |
| `cacheSet(key, value, {ttl?})`         | Set with optional TTL.                       |
| `cacheDelete(key)`                     | Delete key.                                  |
| `cacheExists(key)`                     | Check if key exists.                         |
| `cacheGetOrSet(key, fetchFn, options)` | Cache-aside pattern. Get or fetch and cache. |

**TTL Constants:**

- `CACHE_TTL.LOGO`: 7 days
- `CACHE_TTL.LOGO_SEARCH`: 1 day
- `CACHE_TTL.USER_PREFERENCES`: 30 days
- `CACHE_TTL.SHORT`: 5 minutes

---

### Logging

**File:** `src/lib/logger.ts`

Pino-based structured logging.

```typescript
Logger.info("Message", { data });
Logger.warn("Warning", { context });
Logger.error("Error", { error, statusCode });
```

---

## 6. Components

### Dialogs

| Component                  | File                                   | Description                                |
| -------------------------- | -------------------------------------- | ------------------------------------------ |
| `UnifiedTransactionDialog` | `dialogs/UnifiedTransactionDialog.tsx` | Add transaction to both budget and account |
| `DeleteConfirmDialog`      | `dialogs/DeleteConfirmDialog.tsx`      | Generic delete confirmation                |

### Form Components

| Component              | File                       | Description                        |
| ---------------------- | -------------------------- | ---------------------------------- |
| `FloatingLabelInput`   | `floating-label-input.tsx` | Input with animated floating label |
| `ProminentAmountInput` | `ProminentAmountInput.tsx` | Large currency input               |
| `CardSelector`         | `CardSelector.tsx`         | Radio-like card selection          |
| `FormSection`          | `FormSection.tsx`          | Section wrapper with title         |

### Navigation

| Component       | File                 | Description                    |
| --------------- | -------------------- | ------------------------------ |
| `MonthPicker`   | `month-picker.tsx`   | Month/year picker popover      |
| `MonthSelector` | `month-selector.tsx` | Previous/next month navigation |
| `Sidebar`       | `sidebar/index.tsx`  | App navigation sidebar         |

### Service Integration

| Component             | File                       | Description                        |
| --------------------- | -------------------------- | ---------------------------------- |
| `ServiceAutocomplete` | `service-autocomplete.tsx` | Autocomplete using logo search API |
| `ServiceLogo`         | `service-logo.tsx`         | Logo display with fallback         |

### UI Primitives

`src/components/ui/` contains 31 Shadcn components: AlertDialog, Alert, Avatar, Badge, Banner, Button, Calendar, Card, Carousel, Command, DatePicker, Dialog, DropdownMenu, Input, Label, NavigationMenu, Popover, Progress, Select, Separator, Skeleton, Slider, Sonner, StatusBadge, Switch, Tabs, Textarea, ToggleGroup, Toggle, Tooltip.

---

## 7. Types

### Type Files

| Domain               | File                                   |
| -------------------- | -------------------------------------- |
| Database             | `src/lib/database.types.ts`            |
| Allocations          | `src/app/allocations/types.ts`         |
| Balance Sheet        | `src/app/balancesheet/types.ts`        |
| Dashboard            | `src/app/dashboard/types.ts`           |
| Unified Transactions | `src/lib/types/unified-transaction.ts` |

### Key Enums

```typescript
// Allocations
type CategoryType = "regular" | "savings_goal" | "debt_payment";

// Balance Sheet
type AccountClass = "asset" | "liability";
type AccountCategory = "banking" | "investment" | "retirement" | "property" | "credit" | "debt" | "other";
type TransactionType = "deposit" | "withdrawal" | "interest" | "payment" | "adjustment" | "contribution" | "transfer";

// Recurring
type RecurringExpenseStatus = "paid" | "partial" | "unpaid" | "overpaid" | "upcoming" | "overdue";
type BillingPeriod = "monthly" | "yearly" | "weekly" | "biweekly";

// Dashboard
type Period = "month" | "quarter" | "year";
```

---

## Database Migrations

Located in `supabase/migrations/`:

| Migration                       | Description                        |
| ------------------------------- | ---------------------------------- |
| `001_core_identity.sql`         | Users, profiles, triggers          |
| `002_finance_accounts.sql`      | Account types, accounts, history   |
| `003_budgeting_allocations.sql` | Allocations, categories, templates |
| `004_finance_transactions.sql`  | Transactions, account_transactions |
| `005_feature_recurring.sql`     | Recurring expenses                 |
| `006_infra_storage.sql`         | File storage policies              |

---

_End of Reference_
