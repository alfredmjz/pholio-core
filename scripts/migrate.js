/**
 * Database Migration Script
 * Run this script to apply all database migrations to Supabase
 *
 * Usage: bun scripts/migrate.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
function loadEnv() {
	const envPath = path.join(__dirname, "../src/.env.local");
	if (fs.existsSync(envPath)) {
		console.log(`🔄 Loading environment variables from ${envPath}`);
		const envContent = fs.readFileSync(envPath, "utf8");
		envContent.split("\n").forEach((line) => {
			const match = line.match(/^([^=:#]+?)\s*=\s*(.*)?\s*$/);
			if (match) {
				const key = match[1];
				const value = match[2] || "";
				if (!process.env[key]) {
					process.env[key] = value.replace(/^['"]|['"]$/g, "");
				}
			}
		});
	}
}

loadEnv();

// Read all migration files
function getMigrationFiles() {
	const migrationsDir = path.join(__dirname, "../supabase/migrations");

	if (!fs.existsSync(migrationsDir)) {
		console.error("❌ Error: migrations directory not found at", migrationsDir);
		process.exit(1);
	}

	const files = fs
		.readdirSync(migrationsDir)
		.filter((file) => file.endsWith(".sql") && file !== "000_destroy_and_reset.sql")
		.sort(); // Sort to ensure order

	return files.map((file) => ({
		name: file,
		path: path.join(migrationsDir, file),
		content: fs.readFileSync(path.join(migrationsDir, file), "utf8"),
	}));
}

// Main migration function
async function runMigrations() {
	console.log("════════════════════════════════════════════════════════════");
	console.log("  📋 Pholio Database Migration Tool");
	console.log("════════════════════════════════════════════════════════════\n");

	const migrations = getMigrationFiles();

	if (migrations.length === 0) {
		console.error("❌ Error: No migration files found");
		console.error("   Expected location: supabase/migrations/*.sql");
		process.exit(1);
	}

	console.log(`📝 Found ${migrations.length} migration file(s):\n`);
	migrations.forEach((m, i) => {
		console.log(`   ${i + 1}. ${m.name}`);
	});
	console.log("");

	// Combine all migrations into a single SQL file
	const outputDir = path.join(__dirname, "..", "supabase", "generated");
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const outputPath = path.join(outputDir, "combined-migrations.sql");

	let combinedSQL = "-- ════════════════════════════════════════════════════════════\n";
	combinedSQL += "-- Combined Database Migrations for Pholio\n";
	combinedSQL += `-- Generated: ${new Date().toISOString()}\n`;
	combinedSQL += `-- Total migrations: ${migrations.length}\n`;
	combinedSQL += "-- ════════════════════════════════════════════════════════════\n";
	combinedSQL += "--\n";
	combinedSQL += "-- INSTRUCTIONS:\n";
	combinedSQL += "-- 1. Copy ALL content from this file (Ctrl+A, Ctrl+C)\n";
	combinedSQL += "-- 2. Go to: https://supabase.com/dashboard → Your Project\n";
	combinedSQL += '-- 3. Click "SQL Editor" in the left sidebar\n';
	combinedSQL += "-- 4. Create a new query\n";
	combinedSQL += "-- 5. Paste this content (Ctrl+V)\n";
	combinedSQL += '-- 6. Click "Run" (or press Ctrl+Enter)\n';
	combinedSQL += '-- 7. Verify the "users" table appears in Table Editor\n';
	combinedSQL += "--\n";
	combinedSQL += "-- ════════════════════════════════════════════════════════════\n\n";

	migrations.forEach((migration, index) => {
		combinedSQL += "\n";
		combinedSQL += "-- ╔═════════════════════════════════════════════════════════════╗\n";
		combinedSQL += `-- ║  Migration ${(index + 1).toString().padStart(2)}: ${migration.name.padEnd(44)} ║\n`;
		combinedSQL += "-- ╚═════════════════════════════════════════════════════════════╝\n\n";
		combinedSQL += migration.content;
		combinedSQL += "\n\n";
	});

	combinedSQL += "-- ════════════════════════════════════════════════════════════\n";
	combinedSQL += "-- ✅ End of Migrations\n";
	combinedSQL += "-- ════════════════════════════════════════════════════════════\n";

	// Write to file
	fs.writeFileSync(outputPath, combinedSQL, "utf8");

	// Generate Production Safe Update Script
	const prodSafePath = path.join(outputDir, "production-safe-update.sql");
	const prodSafeSQL = `-- ════════════════════════════════════════════════════════════
-- Pholio Production Database Safe Update Script
-- ════════════════════════════════════════════════════════════
--
-- This script contains ONLY the incremental changes introduced in recent
-- updates. It is completely safe to run on an existing production database
-- with active data. It does not drop tables or truncate records.
--
-- INSTRUCTIONS:
-- 1. Copy ALL content from this file.
-- 2. Go to: https://supabase.com/dashboard → Your Project
-- 3. Click "SQL Editor" in the left sidebar.
-- 4. Create a new query, paste this script, and click "Run".
--
-- ════════════════════════════════════════════════════════════

-- 1. Create Transaction Presets Table
CREATE TABLE IF NOT EXISTS public.transaction_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(200) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'interest', 'payment', 'adjustment', 'contribution', 'transfer', 'refund')),
    category_id UUID REFERENCES public.allocation_categories(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS and Policies for Transaction Presets
ALTER TABLE public.transaction_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own presets" ON public.transaction_presets;
CREATE POLICY "Users can manage own presets" ON public.transaction_presets FOR ALL USING (auth.uid() = user_id);

-- 3. Create update_at Trigger for Transaction Presets
DROP TRIGGER IF EXISTS update_transaction_presets_updated_at ON public.transaction_presets;
CREATE TRIGGER update_transaction_presets_updated_at BEFORE UPDATE ON public.transaction_presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_transaction_presets_user ON public.transaction_presets(user_id);

-- 5. Grant Permissions to Authenticated Users
GRANT ALL ON public.transaction_presets TO authenticated;

-- 6. Clean up Duplicate Foreign Key Constraint on transactions
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_linked_account_transaction_id_fkey;

-- 7. Remove Stale expected income column from users
ALTER TABLE public.users DROP COLUMN IF EXISTS default_expected_income;

-- 8. Clean up outdated constraint on recurring expenses
ALTER TABLE public.recurring_expenses DROP CONSTRAINT IF EXISTS recurring_expenses_billing_period_check;
`;
	fs.writeFileSync(prodSafePath, prodSafeSQL, "utf8");

	console.log("✅ Migration file created successfully!\n");
	console.log("📄 File location:");
	console.log(`   ${outputPath}\n`);

	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("  📋 NEXT STEPS:");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("");
	console.log("  1. Open: supabase/generated/combined-migrations.sql");
	console.log("  2. Select all content (Ctrl+A) and copy (Ctrl+C)");
	console.log("  3. Go to: https://supabase.com/dashboard");
	console.log("  4. Select your project → SQL Editor → New query");
	console.log("  5. Paste the SQL (Ctrl+V)");
	console.log('  6. Click "Run" to create the database tables');
	console.log("");
	console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
	console.log("");
	console.log("💡 Why manual execution?");
	console.log("   For security, Supabase requires database changes to be reviewed");
	console.log("   and executed through their dashboard. This ensures you see exactly");
	console.log("   what changes are being made to your database.");
	console.log("");
	console.log("   (Automated execution would require a Service Role Key with full");
	console.log("   admin access, which is a security risk to store in your project)");
	console.log("");
	console.log("📖 For detailed instructions, see: README.md");
	console.log("");
}

// Run the migrations
runMigrations().catch((error) => {
	console.error("❌ Migration failed:", error.message);
	process.exit(1);
});
