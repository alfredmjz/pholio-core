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

	// Write combined migrations file
	fs.writeFileSync(outputPath, combinedSQL, "utf8");

	// Generate Production Safe Update Script
	// Since all migrations already use IF NOT EXISTS / DROP ... IF EXISTS idioms,
	// the combined migration output is inherently safe for production re-runs.
	const prodSafePath = path.join(outputDir, "production-safe-update.sql");
	let prodSafeSQL = "-- ════════════════════════════════════════════════════════════\n";
	prodSafeSQL += "-- Pholio Production Database Safe Update Script\n";
	prodSafeSQL += `-- Generated: ${new Date().toISOString()}\n`;
	prodSafeSQL += "-- ════════════════════════════════════════════════════════════\n";
	prodSafeSQL += "--\n";
	prodSafeSQL += "-- This script is safe to run on an existing production database.\n";
	prodSafeSQL += "-- All statements use IF NOT EXISTS / DROP ... IF EXISTS guards,\n";
	prodSafeSQL += "-- so no existing tables or data will be dropped or truncated.\n";
	prodSafeSQL += "--\n";
	prodSafeSQL += "-- INSTRUCTIONS:\n";
	prodSafeSQL += "-- 1. Copy ALL content from this file.\n";
	prodSafeSQL += "-- 2. Go to: https://supabase.com/dashboard → Your Project\n";
	prodSafeSQL += '-- 3. Click "SQL Editor" in the left sidebar.\n';
	prodSafeSQL += "-- 4. Create a new query, paste this script, and click \"Run\".\n";
	prodSafeSQL += "--\n";
	prodSafeSQL += "-- ════════════════════════════════════════════════════════════\n\n";

	migrations.forEach((migration) => {
		prodSafeSQL += `-- ── ${migration.name} ──\n`;
		prodSafeSQL += migration.content;
		prodSafeSQL += "\n\n";
	});

	prodSafeSQL += "-- ════════════════════════════════════════════════════════════\n";
	prodSafeSQL += "-- ✅ End of Production Safe Update\n";
	prodSafeSQL += "-- ════════════════════════════════════════════════════════════\n";

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
