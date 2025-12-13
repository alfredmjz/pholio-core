# Pholio - Portfolio Management Platform

A modern portfolio management platform built with Next.js 15 and Supabase.

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
# 1. Open database/generated/combined-migrations.sql
# 2. Copy all content (Ctrl+A, Ctrl+C)
# 3. Go to Supabase Dashboard → SQL Editor → New query
# 4. Paste (Ctrl+V) and click "Run"
```

### 4. Start Development Server

```bash
bun run dev (Runs with real data)
bun run dev:mock (Runs with mock data)
```

Visit [http://localhost:3000](http://localhost:3000)

## Features

✅ User authentication (signup/login/logout)
✅ User profile management
✅ Row Level Security (RLS)
✅ Automatic profile creation
✅ RESTful API endpoints
✅ Server Actions support
✅ Centralized error handling
✅ TypeScript type safety

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Language**: TypeScript
- **Error Handling**: Custom error classes with standardized responses

## Project Structure

```
pholio/
├── src/
│   ├── app/
│   │   ├── (auth-pages)/      # Authentication pages
│   │   │   └── login/
│   │   │       ├── page.tsx   # Login UI
│   │   │       └── actions.ts # Server actions (login, signup, signOut)
│   │   └── api/
│   │       └── auth/
│   │           └── users/
│   │               ├── profile/route.ts # GET/PATCH profile
│   │               └── signup/route.ts  # POST signup
│   ├── lib/
│   │   ├── errors.ts          # Error handling system
│   │   ├── database.types.ts  # TypeScript database types
│   │   └── supabase/
│   │       └── server.ts      # Supabase server client
│   └── .env.local             # Environment variables
├── database/
│   ├── migrations/                # Source migration files
│   │   └── 001_create_users_table.sql
│   ├── generated/                 # Generated SQL (git ignored)
│   │   └── combined-migrations.sql
│   └── README.md                  # Database documentation
├── scripts/
│   ├── migrate.js             # Generate migration SQL
│   ├── migrate.ps1            # PowerShell migration helper
│   └── migrate.bat            # Windows batch wrapper
├── PHOLIO_API_DOCUMENTATION.docx  # Detailed API documentation
└── README.md                  # This file
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

### Server Actions

Located in `src/app/(auth-pages)/login/actions.ts`:

- **login(formData)** - Login with email/password
- **signup(formData)** - Register new account
- **signOut()** - Logout user

## Database Schema

### Users Table

```sql
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### Database Triggers

1. **on_auth_user_created** - Automatically creates profile in `public.users` when user signs up in `auth.users`
2. **update_users_updated_at** - Automatically updates `updated_at` timestamp on profile changes

### Row Level Security Policies

- Users can view their own profile (`auth.uid() = id`)
- Users can insert their own profile (`auth.uid() = id`)
- Service role can insert profiles (for triggers)
- Users can update their own profile (`auth.uid() = id`)

## Error Handling

All API endpoints use a centralized error handling system with standardized responses.

### Error Response Format

```json
{
	"error": {
		"message": "Email and password are required",
		"code": "VALIDATION_ERROR",
		"statusCode": 422,
		"details": {
			"hasEmail": false,
			"hasPassword": true
		},
		"timestamp": "2025-01-08T12:34:56.789Z"
	}
}
```

### Error Codes

| Code                  | Status | Description             |
| --------------------- | ------ | ----------------------- |
| `BAD_REQUEST`         | 400    | Invalid request data    |
| `UNAUTHORIZED`        | 401    | Not authenticated       |
| `FORBIDDEN`           | 403    | No permission           |
| `NOT_FOUND`           | 404    | Resource not found      |
| `CONFLICT`            | 409    | Resource already exists |
| `VALIDATION_ERROR`    | 422    | Input validation failed |
| `INTERNAL_ERROR`      | 500    | Server error            |
| `SERVICE_UNAVAILABLE` | 503    | External service down   |

### Using Error Handlers in Code

See JSDoc comments in `src/lib/errors.ts` for detailed usage examples.

```typescript
import { asyncHandler, validate } from "@/lib/errors";

export const POST = asyncHandler(
	async (request: Request) => {
		const body = await request.json();
		validate(body.email, "Email is required");
		// ... your logic
	},
	{ endpoint: "/api/example" }
);
```

## Database Migrations

### Creating New Migrations

1. Create file in `database/migrations/`: `002_your_migration_name.sql`
2. Write SQL migration with:
   - `CREATE TABLE IF NOT EXISTS`
   - `DROP POLICY IF EXISTS` before creating policies
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
   - Comments describing the migration

3. Run migration script:

```bash
bun run db:migrate
```

4. Apply in Supabase SQL Editor (copy from `database/generated/combined-migrations.sql`)

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
- Minimum 6 characters password requirement
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
```

**Note**: No Service Role Key required - migrations are applied manually for security.

## Troubleshooting

### "Could not find the table 'public.users'"

- **Cause**: Migrations haven't been run yet
- **Solution**: Run migration script and apply SQL in Supabase Dashboard

### "Unauthorized" error on profile access

- **Cause**: User not logged in or session expired
- **Solution**: Ensure user is logged in via `/login` page

### "Profile was not created by trigger"

- **Cause**: Database trigger not created or not firing
- **Solution**: Verify trigger exists on `auth.users` table in Supabase Dashboard

### Migration script errors

- **Cause**: Migration files not found or invalid
- **Solution**: Ensure `.sql` files exist in `database/migrations/` directory

## Documentation

- **Complete API Reference**: See `PHOLIO_API_DOCUMENTATION.docx` for detailed documentation
- **Code Documentation**: See JSDoc comments in source files
- **Database Schema**: See `database/migrations/001_create_users_table.sql`
- **Error Handling**: See JSDoc in `src/lib/errors.ts`

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/name`)
3. Commit changes with descriptive messages
4. Push to branch (`git push origin feature/name`)
5. Create Pull Request

## License

MIT

---

**Happy coding!** 🚀
