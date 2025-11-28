# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pholio is an automated personal finance tracker and budgeting application built with Next.js 15 and Supabase. It provides unified financial tracking by aggregating data from multiple institutions with AI-powered categorization and insights.

**Current Status**: MVP Development (~35% complete)
**Main Branch**: `main`
**Development Branch**: `development`

## Development Principles & Workflow

**CRITICAL: All development work must follow the principles outlined in `/context/development-principles.md`**

This comprehensive document establishes:

- **Planning Requirements**: When and how to create implementation plans
- **To-Do List Management**: Mandatory task tracking for all multi-step work
- **Code Review Process**: Self-review and peer review standards
- **Documentation Standards**: What, when, and how to document
- **Coding Best Practices**: TypeScript, React, security, and database conventions
- **Testing Requirements**: Manual and automated testing expectations
- **Git Workflow**: Branch naming, commit messages, and PR templates
- **Handoff Protocol**: How to ensure work continuity if progress stops

**Key Workflow Rules:**

1. **Always create a to-do list before execution** for non-trivial tasks (use TodoWrite tool)
2. **Update to-do status after each step** (pending → in_progress → completed)
3. **Create spec documents** in `docs/[feature]-spec.md` for all features/refactors
4. **Document for continuity** - future engineers should understand your work
5. **Test thoroughly** before requesting review (manual + visual verification)
6. **Never skip planning** for multi-step or complex tasks

See `/context/development-principles.md` for complete workflow, templates, and standards.

## AI Agents

**CRITICAL: All development work must make use of the correct AI Agents available based on their responsibility and situation**

Specialized agents located in `.claude/agents/` - invoke using Task tool. Full agent definitions contain complete instructions.

| Agent                | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| **ui-ux-designer**   | UI/UX design, component creation, accessibility    |
| **design-review**    | Comprehensive UI review before PRs                 |
| **orchestrator**     | Break down complex tasks, coordinate specialists   |
| **system-architect** | Architecture decisions, data models, system design |
| **senior-engineer**  | Implementation, coding, optimization, debugging    |
| **code-reviewer**    | Code review, security, patterns, quality assurance |

**Agent workflow for complex features**: orchestrator → system-architect → ui-ux-designer → senior-engineer → code-reviewer → design-review

## Context Files

Reference documents in `context/` directory - comprehensive guides for standards and workflows.

| File                          | Purpose                                                       | When to Reference                                                   |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| **design-principles.md**      | S-Tier SaaS UI/UX standards (Stripe, Airbnb, Linear inspired) | Before UI implementation, visual verification, accessibility checks |
| **development-principles.md** | Complete workflow, coding standards, planning templates       | Before starting tasks, during code review, creating specs/commits   |

**Key principle**: All development must follow `development-principles.md` workflow. All UI must adhere to `design-principles.md` standards.

## Specification Documents

**Location**: `docs/[feature]-spec.md` - detailed implementation plans for tracking progress and enabling handoffs.

**Purpose**: Phase-by-phase breakdown, decision records, testing checklists. Engineers/agents can pick up work at any point.

**Required for**: New features, refactors, UI redesigns, database changes, API modifications, performance work, multi-file fixes.

**Template and guidelines**: See `/context/development-principles.md` for complete spec document structure.

**Example**: `docs/profile-page-redesign-spec.md`

### Progress Tracking Requirements

**CRITICAL**: All spec documents MUST include progress tracking to provide clear visibility into work status.

**Required elements in every spec file:**

1. **Status Header** - At the top of the file:

   ```markdown
   **Status:** [✅ COMPLETE | 🟡 IN PROGRESS | 📋 PLANNED | ⏸️ PAUSED | ❌ BLOCKED]
   **Created:** YYYY-MM-DD
   **Last Updated:** YYYY-MM-DD
   **Owner:** [agent-name or developer-name]
   ```

2. **Implementation Progress Table** - Mandatory section showing all phases:

   ```markdown
   ## Implementation Progress

   | Phase | Task      | Estimated | Status         |
   | ----- | --------- | --------- | -------------- |
   | 1     | Task name | 15 min    | ✅ Complete    |
   | 2     | Task name | 30 min    | 🟡 In Progress |
   | 3     | Task name | 45 min    | 📋 Pending     |
   ```

3. **Testing Checklist** - With checkboxes for verification:

   ```markdown
   ## Testing Checklist

   - [x] Test case 1
   - [x] Test case 2
   - [ ] Test case 3
   ```

**When working on a spec:**

- ✅ Update the status header when starting/pausing/completing work
- ✅ Check off phases in the progress table as you complete them (use ✅, 🟡, ❌ emojis)
- ✅ Mark testing checklist items as completed
- ✅ Update "Last Updated" date whenever you modify the spec
- ✅ Add notes about blockers or challenges encountered

**Why this matters:**

- Provides instant visibility into project status
- Enables seamless handoffs between engineers/agents
- Tracks actual vs estimated time for future planning
- Creates accountability and prevents forgotten tasks
- Allows managers/stakeholders to check progress without interrupting work

## Development Commands

### Local Development

```bash
# Start development server (port 3000)
cd src && npm run dev

# Build for production
cd src && npm run build

# Start production server
cd src && npm start
```

### Docker Development

```bash
# Start with Docker (from root)
npm start              # Runs docker-compose up
npm run build          # Runs docker-compose up --build
npm run down           # Stops containers
npm run logs           # View logs
```

### Database Migrations

```bash
# Generate combined migration SQL file
cd src && npm run db:migrate

# Then manually apply:
# 1. Open database/generated/combined-migrations.sql
# 2. Copy all content (Ctrl+A, Ctrl+C)
# 3. Go to Supabase Dashboard → SQL Editor → New query
# 4. Paste and click "Run"
```

**Important**: Migrations are applied manually through Supabase Dashboard for security. The script generates SQL but does NOT execute it automatically.

## Architecture

### Technology Stack

- **Framework**: Next.js 15 (App Router with React Server Components)
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth (JWT sessions with httpOnly cookies)
- **UI Library**: Radix UI + Tailwind CSS
- **TypeScript**: Strict type safety throughout
- **Deployment**: Docker containerization

### Key Architectural Patterns

#### Authentication Flow

1. **Middleware**: All requests pass through `src/middleware.ts` which calls `updateSession()` from `@/lib/supabase/middleware` to refresh expired auth tokens automatically
2. **Server Client**: Use `createClient()` from `@/lib/supabase/server.ts` in Server Components and API routes
3. **Client**: Use functions from `@/lib/supabase/client.ts` for client-side operations
4. **Guest Accounts**: Support anonymous login with server-assigned random names that can be upgraded to full accounts via `/api/auth/users/guest/convert`

#### Database Patterns

- **RLS (Row Level Security)**: Enabled on all tables - users can only access their own data
- **Automatic Profile Creation**: Database trigger `on_auth_user_created` automatically creates `public.users` profile when user signs up in `auth.users`
- **Triggers**: `handle_new_user()` uses `SECURITY DEFINER` to bypass RLS safely when creating profiles
- **Guest Support**: Database schema includes `is_guest` and `guest_name` fields for anonymous users

#### Error Handling

All API endpoints use centralized error handling from `src/lib/errors.ts`:

- `asyncHandler()`: Wraps route handlers to catch and format errors consistently
- `validate()`: Throws validation errors with proper status codes
- Custom error classes: `UnauthorizedError`, `BadRequestError`, `ConflictError`, etc.
- Standardized error response format with `code`, `statusCode`, `message`, `details`, `timestamp`

#### Component Architecture

- **Root Layout**: `src/app/layout.tsx` wraps all pages with `LayoutWrapper` and `SidebarWrapper`
- **Sidebar**: Collapsible/resizable sidebar with user profile and navigation
- **Guest Upgrade**: `guest-convert-dialog.tsx` component for converting guest accounts
- **Toast Notifications**: Sonner library for user feedback

### Project Structure

```
pholio/
├── src/                              # Next.js application root
│   ├── app/
│   │   ├── (auth-pages)/             # Route group for auth pages
│   │   │   ├── login/
│   │   │   │   ├── page.tsx          # Login UI
│   │   │   │   └── actions.ts        # Server actions: login, signup, signOut
│   │   │   ├── signup/
│   │   │   │   ├── page.tsx          # Signup page
│   │   │   │   └── success/          # Post-signup success page
│   │   │   ├── confirm/route.ts      # Email confirmation handler
│   │   │   └── error/page.tsx        # Error page
│   │   ├── api/auth/users/
│   │   │   ├── signup/route.ts       # POST - Register new user
│   │   │   ├── profile/route.ts      # GET/PATCH - User profile
│   │   │   └── guest/
│   │   │       └── convert/route.ts  # POST - Upgrade guest account
│   │   ├── layout.tsx                # Root layout with sidebar
│   │   └── page.tsx                  # Home page
│   ├── components/
│   │   ├── ui/                       # Radix UI components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── card.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── navigation-menu.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── toggle.tsx
│   │   │   └── toggle-group.tsx
│   │   ├── sidebar.tsx               # Sidebar component
│   │   ├── sidebarWrapper.tsx        # Sidebar container
│   │   ├── layoutWrapper.tsx         # Main layout wrapper
│   │   ├── transactionForm.tsx       # Transaction input form
│   │   ├── guest-convert-dialog.tsx  # Guest upgrade dialog
│   │   └── dialog.tsx                # Custom dialog component
│   ├── hooks/
│   │   └── use-mobile.ts             # Mobile detection hook
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts             # Server-side Supabase client
│   │   │   ├── client.ts             # Client-side Supabase functions
│   │   │   └── middleware.ts         # Auth token refresh middleware
│   │   ├── errors.ts                 # Centralized error handling
│   │   ├── utils.ts                  # Utility functions (cn, etc.)
│   │   └── database.types.ts         # TypeScript database types
│   ├── styles/
│   │   └── globals.css               # Global CSS and Tailwind imports
│   ├── utils/
│   │   └── utils.ts                  # Additional utility functions
│   ├── public/
│   │   └── pholio-icon.svg           # App icon
│   ├── middleware.ts                 # Next.js middleware for auth
│   ├── tailwind.config.ts            # Tailwind CSS configuration
│   ├── components.json               # shadcn/ui configuration
│   ├── Dockerfile                    # Docker image configuration
│   └── .env.local                    # Environment variables (not in git)
├── database/
│   ├── migrations/                   # Source migration files
│   │   └── 001_create_users_table.sql
│   └── generated/                    # Generated combined SQL (gitignored)
│       └── combined-migrations.sql
├── scripts/
│   ├── migrate.js                    # Migration script
│   ├── migrate.ps1                   # PowerShell wrapper
│   └── migrate.bat                   # Windows batch wrapper
└── docker-compose.yml                # Docker configuration
```

## Database Schema

### Current Tables

#### `public.users`

- Primary user profile table
- Links to `auth.users` via foreign key
- Supports both registered and guest accounts
- Includes: `id`, `email`, `full_name`, `avatar_url`, `is_guest`, `guest_name`, `created_at`, `updated_at`
- Indexes on `email` and `is_guest`
- RLS policies restrict access to own profile only

### Migration Guidelines

When creating new migrations:

1. **Create file**: `database/migrations/XXX_description.sql` (use sequential numbering)
2. **Use idempotent patterns**:

   ```sql
   DROP TABLE IF EXISTS tablename CASCADE;
   CREATE TABLE tablename (...);

   DROP POLICY IF EXISTS "policy_name" ON tablename;
   CREATE POLICY "policy_name" ON tablename ...;
   ```

3. **Always enable RLS**: `ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;`
4. **Use SECURITY DEFINER carefully**: Only for trusted trigger functions
5. **Handle errors gracefully**: Use exception blocks in functions
6. **Add indexes**: For frequently queried columns
7. **Grant permissions**: `GRANT USAGE ON SCHEMA public TO anon, authenticated;`

## API Conventions

### RESTful Routes

All API routes are in `src/app/api/` and follow REST conventions:

- Use proper HTTP methods (GET, POST, PATCH, DELETE)
- Return consistent JSON responses
- Use `asyncHandler()` wrapper for error handling
- Validate inputs with `validate()` function

### Server Actions

Located in `actions.ts` files alongside pages (e.g., `app/(auth-pages)/login/actions.ts`):

- Use `'use server'` directive
- Handle form submissions
- Redirect using `redirect()` from 'next/navigation'
- Use Supabase server client

### Authentication

- **Get current user**:
  ```typescript
  const supabase = await createClient();
  const {
  	data: { user },
  } = await supabase.auth.getUser();
  ```
- **Check authentication**: Throw `UnauthorizedError` if `!user`
- **Access profile**: Query `users` table with `user.id`

## Planned Features (Roadmap)

### Core (Foundation) - Planned

- Monthly budget planning with templates
- Available budget tracking from expected income
- Debt and savings calculators
- Carry-forward totals
- Export functionality (Excel, PDF)

### Iteration #1: Dashboard & Analytics - Planned

- Stock-portfolio-style dashboard
- Net worth aggregation
- Monthly expenses pie chart
- Monthly income histogram
- Net profit calculation
- Debt tracking visualization

### Iteration #2: Transactions - Planned

- Real-time transaction tracking
- Plaid API integration for auto-updates
- Automatic categorization
- Bank statement import
- Credit card payment tracking
- Bill due date notifications

### Iteration #3: AI Capabilities - Future

- ML-powered transaction categorization
- Cash flow analysis and alerts
- Natural language query interface
- Predictive budgeting recommendations

## Visual Development & Testing

### Design System

The project follows S-Tier SaaS design standards inspired by Stripe, Airbnb, and Linear. All UI development must adhere to:

- **Design Principles**: `/context/design-principles.md` - Comprehensive checklist for world-class UI
- **Component Library**: NextUI with custom Tailwind configuration

### Quick Visual Check

**IMMEDIATELY after implementing any front-end change:**

1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `/context/design-principles.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages` ⚠️

This verification ensures changes meet design standards and user requirements.

### Comprehensive Design Review

For significant UI changes or before merging PRs, use the design review agent:

```bash
# Option 1: Use the slash command
/design-review

# Option 2: Invoke the agent directly
@agent-design-review
```

The design review agent will:

- Test all interactive states and user flows
- Verify responsiveness (desktop/tablet/mobile)
- Check accessibility (WCAG 2.1 AA compliance)
- Validate visual polish and consistency
- Test edge cases and error states
- Provide categorized feedback (Blockers/High/Medium/Nitpicks)

### Playwright MCP Integration

#### Essential Commands for UI Testing

```javascript
// Navigation & Screenshots
mcp__playwright__browser_navigate(url); // Navigate to page
mcp__playwright__browser_take_screenshot(); // Capture visual evidence
mcp__playwright__browser_resize(width, height); // Test responsiveness

// Interaction Testing
mcp__playwright__browser_click(element); // Test clicks
mcp__playwright__browser_type(element, text); // Test input
mcp__playwright__browser_hover(element); // Test hover states

// Validation
mcp__playwright__browser_console_messages(); // Check for errors
mcp__playwright__browser_snapshot(); // Accessibility check
mcp__playwright__browser_wait_for(text / element); // Ensure loading
```

### Design Compliance Checklist

When implementing UI features, verify:

- [ ] **Visual Hierarchy**: Clear focus flow, appropriate spacing
- [ ] **Consistency**: Uses design tokens, follows patterns
- [ ] **Responsiveness**: Works on mobile (375px), tablet (768px), desktop (1440px)
- [ ] **Accessibility**: Keyboard navigable, proper contrast, semantic HTML
- [ ] **Performance**: Fast load times, smooth animations (150-300ms)
- [ ] **Error Handling**: Clear error states, helpful messages
- [ ] **Polish**: Micro-interactions, loading states, empty states

## When to Use Automated Visual Testing

### Use Quick Visual Check for:

- Every front-end change, no matter how small
- After implementing new components or features
- When modifying existing UI elements
- After fixing visual bugs
- Before committing UI changes

### Use Comprehensive Design Review for:

- Major feature implementations
- Before creating pull requests with UI changes
- When refactoring component architecture
- After significant design system updates
- When accessibility compliance is critical

### Skip Visual Testing for:

- Backend-only changes (API, database)
- Configuration file updates
- Documentation changes
- Test file modifications
- Non-visual utility functions

## Environment Variables

Required in `src/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Note**: Service Role Key is NOT used to prevent security risks.

## Important Notes

- **Docker Context**: When using Docker, the Next.js app runs in `src/` directory
- **Port**: Development server runs on port 3000
- **Authentication**: Automatic token refresh via middleware prevents session expiration
- **Guest Accounts**: Users can try the app without registration, then upgrade later
- **Error Handling**: All API routes use centralized error system - see JSDoc in `src/lib/errors.ts`
- **Type Safety**: Database types are in `src/lib/database.types.ts` (generate from Supabase if needed)
- Use `@/*` path alias for src imports
- During the design stage, every agent should be involved in the discussion and come up with a proposed solution. Then, every agent will have to cast their vote on the proposal. If it is a draw, discussion should be held again and revoted.
- Always create a to-do list before execution and check it off after each step
