# Pholio - Personal Finance & Portfolio Management
## Quick Start

```bash
# 1. Install
bun install

# 2. Configure environment
# - Create src/.env.local with Supabase credentials (see Environment section)
# - Run src/scripts/generate-es256-keys.ts to generate JWT keys

# 3. Setup database
cd src && bun run db:migrate
# Apply generated SQL in Supabase Dashboard → SQL Editor

# 4. Development
cd src
bun run dev          # Start with real data
bun run dev:mock     # Start with mock data
bun run build        # Build for production

# 5. Docker (from root)
bun start            # Start containers
bun run down         # Stop containers
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Technology Stack

| Category      | Technology                                       |
| ------------- | ------------------------------------------------ |
| **Runtime**   | Bun                                              |
| **Framework** | Next.js 15 (App Router, React 19)                |
| **Database**  | Supabase (PostgreSQL), Redis                     |
| **Auth**      | Supabase Auth                                    |
| **Email**     | Resend (SMTP)                                    |
| **UI**        | Tailwind CSS, Radix UI, Shadcn, Recharts         |
| **State**     | React hooks, Zustand                             |
| **Logging**   | Pino                                             |
| **DevOps**    | Docker, Vercel, GitHub Actions, Semantic Release |
| **Language**  | TypeScript (strict)                              |

---

## Environment Variables

Supabase credentials are available in your Supabase dashboard  
Logo API credentials are available from your dashboard at https://www.logo.dev/

```env
# Local Supabase (Docker)
LOCAL_SUPABASE_URL=http://host.docker.internal:54321
LOCAL_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
LOCAL_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Supabase API
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

#Resend (SMTP)
RESEND_API_KEY=...

# Logo API
NEXT_PUBLIC_LOGO_DEV_TOKEN=pk_...
LOGO_DEV_SECRET_KEY=sk_...

```

---

## Project Structure

```
pholio/
├── .agents/                    # AI Agent definitions
├── .context/                   # Development principles
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── allocations/        # Budget management
│   │   ├── balancesheet/       # Assets & liabilities
│   │   ├── dashboard/          # Financial overview
│   │   ├── recurring/          # Subscriptions
│   │   └── settings/           # User preferences
│   ├── components/ui/          # Shadcn components
│   ├── hooks/                  # Custom hooks
│   └── lib/                    # Utilities
└── supabase/migrations/        # Database schema
```

---

## Contributing

### Commit Convention

| Type       | Version Impact        | Example                       |
| ---------- | --------------------- | ----------------------------- |
| `feat`     | Minor (0.1.0 → 0.2.0) | `feat(auth): add guest login` |
| `fix`      | Patch (0.1.0 → 0.1.1) | `fix(ui): sidebar alignment`  |
| `perf`     | Patch (0.1.0 → 0.1.1) | `perf: optimize queries`      |
| `chore`    | None                  | `chore: update dependencies`  |
| `docs`     | None                  | `docs: update readme`         |
| `refactor` | None                  | `refactor: cleanup logging`   |

### Workflow

1. Branch from `main`
2. Follow `.context/development-principles.md` for coding standards
3. Optimize code for performance and readability after development is complete
4. Commit with meaningful messages
5. Create PR with the above convention and detailed description listing functional and file changes

---

## Documentation
- [System Design & Architecture Document](https://pillows-fetch-408.craft.me/2YpClWZLlHneU3)
- [Developer Bible](https://pillows-fetch-408.craft.me/SHcgbc3Pyy6Nqz)
- `AGENTS.md` - AI coding guidelines
- `.context/development-principles.md` - Workflow standards
- `.context/design-principles.md` - UI/UX standards

---

## License

MIT
