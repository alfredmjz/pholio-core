# Pholio - Agentic Coding Guidelines

This document provides comprehensive guidance for AI agents working on the Pholio codebase.

## Project Context

**Pholio** is a personal finance tracker and budgeting application built with:

- Next.js 15 (App Router, React 19)
- TypeScript (strict mode)
- Supabase/PostgreSQL
- Docker

**Main Branch**: `main`
**Development Branch**: `development`

---

## Build & Development Commands

### Local Development (inside `/src`)

```bash
bun run dev          # Start dev server
bun run dev:mock     # Start with mock data
bun run build        # Build for production
bun run start        # Run production build
```

### Docker (from root)

```bash
bun start            # Start containers
bun run down         # Stop containers
bun run clean-rebuild # Clean rebuild
bun run db:migrate   # Generate migration file
```

### Testing

No automated test suite. Testing is done manually:

1. Start dev server: `bun run dev`
2. Navigate to affected pages
3. Test at mobile (375px) and desktop (1440px) breakpoints
4. Check browser console for errors

---

## Code Style Guidelines

### Imports

```typescript
// ✅ Correct
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AllocationCategory } from "@/app/allocations/types";

// ❌ Avoid
import * as UI from "@/components/ui";
```

**Rules**:

- Use `@/` alias for absolute imports
- Use `import type` for type-only imports
- Group: React/Next → Third-party → Local

### TypeScript

```typescript
// ✅ Use database types
import type { Tables } from "@/lib/database.types";

type AllocationWithCategories = Tables<"allocations"> & {
	categories: Tables<"allocation_categories">[];
};

// ✅ Handle null explicitly
const userId = user?.id;
if (userId) {
	/* ... */
}
```

**Rules**:

- Avoid `any` without justification
- Handle `null`/`undefined` explicitly
- Use proper type guards

### Naming Conventions

| Type       | Convention  | Example             |
| ---------- | ----------- | ------------------- |
| Files      | kebab-case  | `user-profile.tsx`  |
| Components | PascalCase  | `TransactionDialog` |
| Functions  | camelCase   | `handleSubmit`      |
| Constants  | UPPER_SNAKE | `SIDEBAR_DEFAULTS`  |
| Types      | PascalCase  | `AllocationSummary` |
| Hooks      | use prefix  | `useAllocationSync` |

### File Organization

| Location                        | Purpose                     |
| ------------------------------- | --------------------------- |
| `src/components/ui/`            | Shadcn UI primitives        |
| `src/components/`               | Shared components           |
| `src/app/[feature]/components/` | Feature-specific components |
| `src/app/[feature]/actions.ts`  | Server actions              |
| `src/app/api/`                  | API routes                  |
| `src/lib/`                      | Utilities, clients, types   |
| `src/hooks/`                    | Custom React hooks          |

---

## Component Patterns

### Server vs Client Components

```typescript
// Server Component (default) - for data fetching
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from("accounts").select("*");
  return <AccountList accounts={data} />;
}

// Client Component - for interactivity
"use client";

import { useState } from "react";

export function AccountList({ accounts }) {
  const [selected, setSelected] = useState(null);
  return /* ... */;
}
```

### Component Size

⚠️ Keep components modular and focused. Extract:

- Form sections into separate components
- Complex rendering logic
- Reusable sub-components

---

## Error Handling

### API Routes

```typescript
import { asyncHandler, validate, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request) {
	return asyncHandler(
		async (request) => {
			const body = await request.json();

			validate(body.email, "Email is required");

			if (!user) {
				throw new UnauthorizedError("Invalid credentials");
			}

			return NextResponse.json({ success: true });
		},
		{ endpoint: "/api/auth/login" }
	);
}
```

### Client Components

```typescript
try {
	await updateProfile(data);
	toast.success("Profile updated");
} catch (error) {
	const message = error instanceof Error ? error.message : "Unexpected error";
	toast.error("Update Failed", { description: message });
}
```

---

## Database Interactions

### Client Selection

| Context           | Import From             |
| ----------------- | ----------------------- |
| Server Components | `@/lib/supabase/server` |
| Client Components | `@/lib/supabase/client` |

### Query Best Practices

```typescript
// ✅ Select only needed columns
const { data } = await supabase.from("users").select("id, full_name, email").eq("id", userId).single();

// ❌ Avoid SELECT *
const { data } = await supabase.from("users").select("*");
```

### Parallel Queries

```typescript
// ✅ Parallelize independent reads
const [summary, transactions] = await Promise.all([getAllocationSummary(id), getTransactionsForMonth(year, month)]);

// ❌ Never parallelize dependent queries
```

---

## Logging

Use the centralized Pino logger for server-side logging:

```typescript
import { Logger } from "@/lib/logger";

Logger.info("Processing request", { userId, endpoint });
Logger.warn("Rate limit approaching", { remaining: 10 });
Logger.error("Database query failed", { error, query });
```

---

## UI Guidelines

### Component Library

- Use Shadcn UI components from `@/components/ui/`
- Use `cn()` utility for conditional classes
- Apply theme tokens from CSS variables

### Responsive Breakpoints

| Breakpoint | Width      |
| ---------- | ---------- |
| Mobile     | < 768px    |
| Tablet     | 768-1023px |
| Desktop    | ≥ 1024px   |

### Design Priorities

1. **Flex** > Grid > Absolute positioning
2. **Gap** > Padding > Margin
3. WCAG 2.1 AA color contrast (4.5:1 minimum)

---

## AI Agent Team & Governance

| Agent Role | Responsibility | Core Focus |
| ---------- | -------------- | ---------- |
| **`orchestrator`** | Technical Lead & Team Coordinator | Task triage, subagent routing, voting coordination, memory categorization |
| **`system-architect`** | System & Database Architect | Architecture decisions, database schema, API contracts, scalability |
| **`ui-ux-designer`** | UI/UX Specialist | Component hierarchy, visual design tokens, interaction flows, accessibility specs |
| **`senior-engineer`** | Implementation Lead | Clean code execution, feature building, refactoring, local bug fixing |
| **`code-reviewer`** | Static QA & Security Auditor | Code quality, RLS & security audit, error handling checks, pattern compliance |
| **`ui-flow-reviewer`** | Visual & User Flow QA Specialist | Live browser testing, visual polish, viewport responsiveness (desktop/tablet/mobile) |

---

## Workflow Execution Paths

1. **Low Complexity (Direct Execution)**: Simple bug fix or minor tweak -> `orchestrator` delegates directly to `senior-engineer` or `code-reviewer`.
2. **Medium Complexity (Linear Pipeline)**: Standard feature module -> `system-architect` / `ui-ux-designer` (spec) → `senior-engineer` (build) → `ui-flow-reviewer` / `code-reviewer` (review).
3. **High Complexity (Voting & Consult Pattern)**:
   - **Trigger**: Major architectural choices, multi-domain features, breaking schema changes, or conflicting technical trade-offs.
   - **Step 1 (Consultation)**: `orchestrator` solicits technical proposals from relevant subagents (`system-architect`, `senior-engineer`, `ui-ux-designer`, `code-reviewer`).
   - **Step 2 (Voting)**: Each subagent provides a structured vote (`Approve Option A/B/Conditional`, `Rationale`, `Risk Assessment`).
   - **Step 3 (Synthesis)**: `orchestrator` tallies votes, resolves constraints, updates long-term decision memory, and finalizes execution plan.

---

## Dual Memory System & Lifecycle

- **Long-Term Memory (`.context/memories/`)** *(Tracked in Repo)*:
  - `architecture.md`: Persistent system architecture, tech stack rules, security boundaries.
  - `decisions.md`: Architectural Decision Records (ADRs) and voting outcomes.
  - `domain.md`: Core domain concepts, entity structures, and business rules.
- **Short-Term Memory (`.agents/scratch/memories/`)** *(Local / Gitignored)*:
  - `session-context.md`: Multi-step sprint progress, transient debug state, temporary working notes.
- **Per-Request Evaluation Rule**: For every request, the `orchestrator` decides whether to update **Long-Term Memory**, update **Short-Term Memory**, or **Forget** (no memory stored for isolated 1-step tasks).

---

## Contributing

### Commit Convention

| Type       | Impact     | Example                       |
| ---------- | ---------- | ----------------------------- |
| `feat`     | Minor bump | `feat(auth): add guest login` |
| `fix`      | Patch bump | `fix(ui): sidebar alignment`  |
| `perf`     | Patch bump | `perf: optimize queries`      |
| `chore`    | No bump    | `chore: update deps`          |
| `docs`     | No bump    | `docs: update readme`         |
| `refactor` | No bump    | `refactor: logging cleanup`   |

### Workflow

1. Check `.context/development-principles.md` for patterns
2. Create spec document for significant features
3. Keep components under 300 lines
4. Test at mobile and desktop breakpoints
5. Use proper error handling patterns

---

## Key Principles

- **Security first**: Always validate input, use RLS policies
- **Type safety**: Avoid `any`, handle null explicitly
- **Performance**: Parallelize independent queries
- **Maintainability**: Keep files small, document decisions
- **Consistency**: Follow established patterns
