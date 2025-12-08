# Dashboard Page Implementation Specification

**Status:** 🟡 IN PROGRESS
**Created:** 2025-12-05
**Last Updated:** 2025-12-05
**Owner:** senior-engineer

## Overview

The Dashboard page is the central hub of Pholio, providing users with a comprehensive overview of their financial health. It features exceptional Cashflow and Net Worth widgets with custom SVG charts, metric cards, and recent transaction summaries.

## Requirements

### Functional Requirements

1. **Metric Cards Section**
   - Display 4 key metrics: Net Worth, Monthly Income, Monthly Expenses, Savings Rate
   - Each card shows current value, trend indicator (up/down/neutral), and comparison period
   - Support multiple visual variants: default, success, error, warning, info
   - Loading skeleton states

2. **Cashflow Widget**
   - Custom SVG bar chart (NO external charting libraries)
   - Period selector: Month / Quarter / Year toggle
   - Dual bars: Income (blue) vs Expenses (red)
   - Summary row showing Total Income, Total Expenses, Net Cashflow
   - Interactive tooltip on hover showing exact values
   - Empty state with call-to-action
   - Loading skeleton state
   - Responsive design (mobile stacks bars vertically)

3. **Net Worth Widget**
   - Large net worth display with gradient background
   - Dual view toggle: Donut Chart / Trend Line
   - **Donut Chart View:**
     - Assets vs Liabilities split
     - Collapsible detailed breakdown section
     - Asset categories with values
     - Liability categories with values
   - **Trend View:**
     - Line chart showing net worth over time
     - 6-month historical data
   - Empty state with call-to-action
   - Loading skeleton state

4. **Recent Transactions**
   - List of last 5 transactions
   - Display: icon, description, category badge, amount
   - "View All" link to transactions page
   - Empty state

5. **Data Handling**
   - Server actions fetch dashboard data
   - Mock data for MVP (DB not fully set up)
   - Currency formatting for CAD
   - Proper TypeScript types for all data structures

### Non-Functional Requirements

1. **Performance**
   - Charts render smoothly with CSS transitions (150-300ms)
   - Loading states prevent layout shift
   - Responsive at 375px (mobile), 768px (tablet), 1440px (desktop)

2. **Design Compliance**
   - Follow `/context/design-principles.md` standards
   - Use semantic colors from `globals.css`: --success, --error, --warning, --info
   - Cards: `p-6 bg-card border border-border`
   - Hover states: `hover:shadow-md transition-shadow duration-200`
   - Typography: text-3xl font-bold for values, text-sm text-muted-foreground for labels

3. **Accessibility**
   - Semantic HTML structure
   - ARIA labels for charts
   - Keyboard navigable toggles
   - Sufficient color contrast (WCAG 2.1 AA)

4. **Code Quality**
   - TypeScript strict mode
   - Reuse patterns from allocations page
   - Component composition (Server + Client separation)
   - Proper error boundaries

## Technical Architecture

### File Structure

```
src/app/dashboard/
├── page.tsx                    # Server Component - main entry point
├── client.tsx                  # Client wrapper with state management
├── actions.ts                  # Server actions for data fetching
├── types.ts                    # TypeScript type definitions
├── utils.ts                    # Utility functions (currency formatting, etc.)
└── components/
    ├── MetricCard.tsx          # Reusable metric display card
    ├── CashflowWidget.tsx      # Custom SVG bar chart widget
    ├── NetWorthWidget.tsx      # Donut/trend chart widget
    └── RecentTransactions.tsx  # Transaction list component
```

### Component Breakdown

#### 1. MetricCard Component

**File:** `src/app/dashboard/components/MetricCard.tsx`
**Type:** Client Component

**Props:**

```typescript
interface MetricCardProps {
	label: string;
	value: number;
	trend?: {
		value: number;
		direction: "up" | "down" | "neutral";
		period: string;
	};
	icon?: React.ComponentType<{ className?: string }>;
	variant?: "default" | "success" | "error" | "warning" | "info";
	loading?: boolean;
	className?: string;
}
```

**Features:**

- Displays metric with large value (text-3xl font-bold)
- Shows trend with arrow icon and percentage
- Color-coded based on variant
- Loading skeleton: animated pulse background
- Icon positioned top-right

**Dependencies:**

- lucide-react (icons)
- @/components/ui/card
- @/lib/utils (cn)

#### 2. CashflowWidget Component

**File:** `src/app/dashboard/components/CashflowWidget.tsx`
**Type:** Client Component

**Props:**

```typescript
interface CashflowWidgetProps {
	data: CashflowDataPoint[];
	period: Period;
	onPeriodChange: (period: Period) => void;
	loading?: boolean;
	className?: string;
}
```

**State:**

- `hoveredIndex: number | null` - tracks bar hover for tooltip

**SVG Chart Specs:**

- ViewBox: "0 0 800 400"
- Bar width: calculated based on data length
- Bar gap: 8px
- Max bar height: 300px
- Y-axis: 5 grid lines
- Colors: Income (#529CCA - info), Expenses (#FF7369 - error)

**Tooltip:**

- Positioned above hovered bar
- Shows date, income, expenses, net
- Arrow pointing to bar
- Background: bg-popover with border

**Empty State:**

- Icon: TrendingUp
- Message: "No cashflow data available"
- CTA: "Add your first transaction"

#### 3. NetWorthWidget Component

**File:** `src/app/dashboard/components/NetWorthWidget.tsx`
**Type:** Client Component

**Props:**

```typescript
interface NetWorthWidgetProps {
	data: NetWorthData;
	loading?: boolean;
	className?: string;
}
```

**State:**

- `chartType: "donut" | "trend"` - toggle between views
- `isBreakdownExpanded: boolean` - collapsible section state

**Donut Chart Specs:**

- Reuse arc generation logic from AllocationDonutChart
- ViewBox: "0 0 100 100"
- Radius: 40
- Stroke width: 12
- Colors: Assets (#4DAB9A - success), Liabilities (#FF7369 - error)
- Center text: Net Worth value

**Trend Chart Specs:**

- SVG line chart
- 6 data points (last 6 months)
- Gradient fill below line
- Grid lines for reference
- Smooth curve using quadratic bezier

**Breakdown Section:**

- Accordion-style collapsible
- Asset categories with sub-accounts
- Liability categories with sub-accounts
- Progress bars showing distribution
- Total for each section

**Empty State:**

- Icon: Wallet
- Message: "No net worth data available"
- CTA: "Connect your accounts"

#### 4. RecentTransactions Component

**File:** `src/app/dashboard/components/RecentTransactions.tsx`
**Type:** Client Component

**Props:**

```typescript
interface RecentTransactionsProps {
	transactions: Transaction[];
	loading?: boolean;
	className?: string;
}
```

**Features:**

- List of 5 most recent transactions
- Icon based on category (ArrowUpCircle for income, ArrowDownCircle for expense)
- Category badge with subtle background
- Amount color-coded (green for income, red for expense)
- "View All" link at bottom
- Empty state with placeholder

### Data Flow

1. **Server Component (page.tsx)**
   - Calls `getDashboardSummary()` server action
   - Passes data to Client component
   - Handles error boundaries

2. **Client Component (client.tsx)**
   - Manages period state for cashflow
   - Manages chart type state for net worth
   - Renders all widgets with data
   - Handles loading states

3. **Server Actions (actions.ts)**
   - `getDashboardSummary()`: Returns complete dashboard data
   - For MVP: Returns mock data
   - Future: Queries Supabase for real data

### Mock Data Structure

```typescript
// Mock data for development
const mockDashboardData: DashboardData = {
	metrics: {
		netWorth: { label: "Net Worth", value: 125000, trend: { value: 5.2, direction: "up", period: "vs last month" } },
		monthlyIncome: {
			label: "Monthly Income",
			value: 8500,
			trend: { value: 2.1, direction: "up", period: "vs last month" },
		},
		monthlyExpenses: {
			label: "Monthly Expenses",
			value: 5200,
			trend: { value: -1.5, direction: "down", period: "vs last month" },
		},
		savingsRate: {
			label: "Savings Rate",
			value: 38.8,
			trend: { value: 3.2, direction: "up", period: "vs last month" },
		},
	},
	cashflow: {
		totalIncome: 25500,
		totalExpenses: 15600,
		netCashflow: 9900,
		period: "month",
		data: [
			/* 12 months of data */
		],
	},
	netWorth: {
		netWorth: 125000,
		totalAssets: 175000,
		totalLiabilities: 50000,
		trend: { value: 5.2, direction: "up", period: "vs last month" },
		assetBreakdown: [
			/* categories */
		],
		liabilityBreakdown: [
			/* categories */
		],
		trendData: [
			/* 6 months */
		],
	},
	recentTransactions: [
		/* 5 transactions */
	],
};
```

## Implementation Progress

| Phase | Task                                  | Estimated | Status         |
| ----- | ------------------------------------- | --------- | -------------- |
| 1     | Create specification document         | 30 min    | 🟡 In Progress |
| 2     | Create types.ts with all interfaces   | 10 min    | 📋 Pending     |
| 3     | Create utils.ts with formatters       | 10 min    | 📋 Pending     |
| 4     | Build MetricCard component            | 30 min    | 📋 Pending     |
| 5     | Build CashflowWidget with SVG chart   | 60 min    | 📋 Pending     |
| 6     | Build NetWorthWidget with donut/trend | 60 min    | 📋 Pending     |
| 7     | Build RecentTransactions component    | 20 min    | 📋 Pending     |
| 8     | Create server actions with mock data  | 20 min    | 📋 Pending     |
| 9     | Build client wrapper component        | 20 min    | 📋 Pending     |
| 10    | Create main page server component     | 15 min    | 📋 Pending     |
| 11    | Manual testing and refinements        | 30 min    | 📋 Pending     |
| 12    | Design review agent validation        | 20 min    | 📋 Pending     |
| 13    | Code review and final polish          | 20 min    | 📋 Pending     |

**Total Estimated Time:** ~5.5 hours

## Design Specifications

### Color Palette (from globals.css)

**Light Mode:**

- Success: #448361
- Error: #D44C47
- Warning: #CB912F
- Info: #337EA9
- Background: #FFFFFF
- Foreground: #37352F
- Muted: #787774
- Border: #E9E9E7

**Dark Mode:**

- Success: #4DAB9A
- Error: #FF7369
- Warning: #FFDC49
- Info: #529CCA
- Background: #191919
- Foreground: #D4D4D4
- Muted: #9B9B9B
- Border: #373737

### Typography

- **Large Values:** text-3xl (30px) font-bold
- **Medium Values:** text-2xl (24px) font-semibold
- **Labels:** text-sm (14px) font-medium text-muted-foreground
- **Trends:** text-xs (12px) font-medium
- **Body:** text-base (16px)

### Spacing

- **Card Padding:** p-6 (24px)
- **Card Gap:** gap-4 (16px) on mobile, gap-6 (24px) on desktop
- **Section Margins:** mb-6 (24px)
- **Element Spacing:** gap-2 (8px) for tight groups, gap-4 (16px) for sections

### Responsive Breakpoints

- **Mobile:** 375px - 767px (grid-cols-1)
- **Tablet:** 768px - 1023px (grid-cols-2)
- **Desktop:** 1024px+ (grid-cols-4 for metrics, grid-cols-2 for widgets)

## Testing Checklist

### Functional Testing

- [ ] Metric cards display correct values and trends
- [ ] Period selector in Cashflow widget works (Month/Quarter/Year)
- [ ] Cashflow chart renders correctly with income/expense bars
- [ ] Tooltip appears on hover with correct data
- [ ] Net Worth widget toggles between Donut/Trend views
- [ ] Breakdown section expands/collapses
- [ ] Recent transactions display correctly
- [ ] "View All" link navigates to transactions page
- [ ] Empty states appear when no data
- [ ] Loading skeletons show during data fetch

### Visual Testing

- [ ] Layout is responsive at 375px, 768px, 1440px
- [ ] Colors match design system (check both light/dark modes)
- [ ] Typography sizes and weights are correct
- [ ] Cards have proper shadows and borders
- [ ] Hover states work smoothly (200ms transition)
- [ ] Charts animate smoothly (150-300ms)
- [ ] No layout shift during loading
- [ ] Icons are properly sized and aligned
- [ ] Trend arrows point correct direction
- [ ] Category badges have readable colors

### Accessibility Testing

- [ ] Semantic HTML (header, main, section, article)
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works for toggles
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 for text)
- [ ] Screen reader announces chart data
- [ ] Alt text for decorative elements
- [ ] No reliance on color alone for information

### Code Quality

- [ ] TypeScript strict mode passes
- [ ] No `any` types
- [ ] Proper error handling
- [ ] Components follow existing patterns
- [ ] CSS variables used instead of hardcoded colors
- [ ] Utility functions are reusable
- [ ] Server/Client separation is clear
- [ ] Mock data is realistic

## Dependencies

### Existing Components

- `@/components/ui/card` - Card wrapper
- `@/components/ui/toggle-group` - Period selector
- `@/lib/utils` - cn utility

### New Dependencies

- `lucide-react` - Icons (already installed)
- No external charting libraries

## Future Enhancements

1. **Real Data Integration**
   - Connect to Supabase transactions table
   - Fetch account balances from accounts table
   - Calculate metrics from actual data

2. **Interactivity**
   - Click bar to filter transactions by period
   - Click donut segment to see category details
   - Drill-down into asset/liability accounts

3. **Customization**
   - User-configurable date ranges
   - Reorderable widgets
   - Hide/show specific metrics
   - Export charts as images

4. **Advanced Features**
   - Budget vs Actual comparison
   - Goal tracking overlay
   - Forecasting trend lines
   - Anomaly detection highlights

## Notes

- **No External Chart Libraries**: Using custom SVG ensures full control over design and reduces bundle size
- **Mock Data**: Since accounts table migration isn't applied yet, all data is mocked
- **CAD Currency**: Default currency is Canadian dollars (en-CA locale)
- **Reusable Patterns**: Following BudgetSummaryCards and AllocationDonutChart patterns
- **Design System**: Adhering to Notion-inspired palette and S-Tier SaaS standards

## References

- Design Principles: `/context/design-principles.md`
- Development Workflow: `/context/development-principles.md`
- Tailwind Config: `src/tailwind.config.ts`
- Color Variables: `src/styles/globals.css`
- Reference Components:
  - `src/app/allocations/components/BudgetSummaryCards.tsx`
  - `src/app/allocations/components/AllocationDonutChart.tsx`
