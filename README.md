# Pholio - Portfolio Management Platform

Extensive portfolio management platform built with Next.js 15 and Supabase.

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Create `src/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Setup Database

```bash
# Generate migration file
cd src && bun run db:migrate

# Then apply in Supabase:
# 1. Open supabase/generated/combined-migrations.sql
# 2. Copy all content (Ctrl+A, Ctrl+C)
# 3. Go to Supabase Dashboard → SQL Editor → New query
# 4. Paste (Ctrl+V) and click "Run"
```

### 4. Start Development Server

```bash
# Development server (Inside /src)
bun run dev (Runs with real data)
bun run dev:mock (Runs with mock data)

# Hosted server (Outside /src)
bun run start
bun run clean-rebuild
```

Visit [http://localhost:3000](http://localhost:3000)

## Features

✅ User authentication (signup/login/logout)
✅ Guest account access (try before you signup)
✅ User profile management
✅ Theme system (Light/Dark/System modes)
✅ Toast notifications (Sonner)
✅ Row Level Security (RLS)
✅ Automatic profile creation
✅ RESTful API endpoints
✅ Server Actions support
✅ Centralized error handling
✅ CI/CD Automation (Semantic Release)
✅ TypeScript type safety

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS, Shadcn UI, next-themes
- **Notifications**: Sonner
- **DevOps**: Docker, GitHub Actions, Semantic Release
- **Language**: TypeScript

## Project Structure

```
pholio/
├── .agents/                   # AI Agents & Workflows
├── .context/                  # Development Principles & Context
├── .github/                   # GitHub Actions (CI/CD)
├── database/                  # Migration files
├── docs/                      # Feature Specifications
├── scripts/                   # Helper scripts
├── src/
│   ├── app/
│   │   ├── (auth-pages)/      # Auth: Login, Signup, Welcome, etc.
│   │   ├── api/               # API Routes (Auth, Google, etc.)
│   │   └── ...
│   ├── components/
│   │   ├── ui/                # Shadcn UI primitive components
│   │   └── ...
│   ├── hooks/                 # Custom React hooks
│   ├── lib/
│   │   ├── supabase/          # Supabase clients (Server/Client)
│   │   └── ...
│   └── .env.local             # Environment variables
├── docker-compose.yml         # Docker configuration
└── README.md                  # Project documentation
```

## API Endpoints

### Authentication

**POST /api/auth/users/signup**

- Register new user
- Body: `{ email, password, fullName? }`
- Returns: `{ success, message, user: { id, email } }`

**GET /api/auth/users/profile**

- Get authenticated user profile (requires login)
- Returns: `{ profile: { id, email, full_name, avatar_url, created_at, updated_at } }`

**PATCH /api/auth/users/profile**

- Update authenticated user profile (requires login)
- Body: `{ fullName?, avatarUrl? }`
- Returns: `{ success, message, profile }`

**POST /api/auth/users/guest/convert**

- Upgrade guest account to permanent user
- Body: `{ email, password, fullName? }`
- Returns: `{ success, message, user }`

### Google Integration

**POST /api/google/export**

- Export portfolio data to Google Sheets
- Requires authenticated session

### Server Actions

Located in `src/app/(auth-pages)/login/actions.ts`:

- **login(formData)** - Login with email/password
- **signup(formData)** - Register new account
- **signOut()** - Logout user

## Database Migrations

### Creating New Migrations

1. Create file in `supabase/migrations/`: `00X_your_migration_name.sql`
2. Write SQL migration with:
   - `CREATE TABLE IF NOT EXISTS`
   - `DROP POLICY IF EXISTS` before creating policies
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
   - Comments describing the migration

3. Run migration script:

```bash
bun run db:migrate
```

4. Apply in Supabase SQL Editor (copy from `supabase/generated/combined-migrations.sql`)

### Best Practices

- Always use `IF NOT EXISTS` for idempotency
- Drop existing policies before recreating
- Enable RLS on all tables
- Add descriptive comments
- Handle errors gracefully in trigger functions
- Grant appropriate permissions

## Scripts

```bash
# Development
bun run dev (Runs with real data)
bun run dev:mock (Runs with mock data)

# Build
bun run build

# Start production
bun start

# Database migration
bun run db:migrate
```

## Security Features

### Authentication

- Password hashing by Supabase Auth
- Minimum 8 characters password requirement
- Email validation
- Session-based authentication with httpOnly cookies

### Database Security

- Row Level Security (RLS) on all tables
- Users can only access their own data
- Triggers use `SECURITY DEFINER` to bypass RLS safely
- Foreign key constraints with `ON DELETE CASCADE`

### API Security

- Input validation on all endpoints
- Proper HTTP status codes
- Error messages don't leak sensitive information
- Stack traces only shown in development

## Environment Variables

Required in `src/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
LOCAL_SUPABASE_URL=<your-local-supabase-url>
LOCAL_SUPABASE_ANON_KEY=<your-local-supabase-anon-key>
```

## Documentation

- **Complete API Reference**: See `PHOLIO_API_DOCUMENTATION.docx` for detailed documentation
- **Code Documentation**: See JSDoc comments in source files
- **Database Schema**: See `supabase/migrations/001_create_users_table.sql`
- **Error Handling**: See JSDoc in `src/lib/errors.ts`

### Documentation

- **Development Principles**: `/.context/development-principles.md`
- **Design Principles**: `/.context/design-principles.md`

## License

MIT

---

**Happy coding!** 🚀
