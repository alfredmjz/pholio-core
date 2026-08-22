# Long-Term Memory: System Architecture

> **Storage Location**: `.context/memories/architecture.md` (Tracked in Repository)  
> **Purpose**: Persists key architectural patterns, tech stack choices, data structures, and security boundaries across developer sessions.

---

## Technical Stack & Infrastructure
- **Frontend / Framework**: Next.js 15 (App Router, React Server Components)
- **Backend / Database**: Supabase (PostgreSQL, Auth, Real-time)
- **Containerization**: Docker & Docker Compose
- **Language**: TypeScript (Strict Mode)

---

## Core Component Boundaries
- **Server Components (Default)**: Used for data fetching directly from Supabase, authorization checks, and initial SSR layout generation.
- **Client Components (`"use client"`)**: Isolated strictly to interactive elements, form handling, modal states, and client-side hooks.
- **Mutations & Business Logic**: Executed via Server Actions (`src/app/[feature]/actions.ts`) or dedicated API routes (`src/app/api/`) wrapped in centralized error handlers.

---

## Security & Data Access Patterns
- **Database Row Level Security (RLS)**: Mandatory on all PostgreSQL tables. Client operations must execute within authenticated RLS policies.
- **Input Validation**: All API inputs and Server Action payloads must be validated using Zod or centralized error validators (`src/lib/errors.ts`).
