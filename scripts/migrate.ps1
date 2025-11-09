# Database Migration PowerShell Script
# Run migrations for Supabase database
#
# Usage: .\scripts\migrate.ps1

Write-Host "🚀 Pholio Database Migration Tool" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$migrationsDir = Join-Path $projectRoot "database\migrations"
$envFile = Join-Path $projectRoot "src\.env.local"

# Load environment variables
function Load-EnvFile {
    param([string]$Path)

    if (Test-Path $Path) {
        Write-Host "📄 Loading environment from: $Path" -ForegroundColor Gray
        Get-Content $Path | ForEach-Object {
            if ($_ -match '^([^=:#]+?)\s*=\s*(.*)?\s*$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim() -replace '^["'']|["'']$', ''
                if (-not (Test-Path "env:$key")) {
                    Set-Item -Path "env:$key" -Value $value
                }
            }
        }
    }
}

Load-EnvFile -Path $envFile

$SUPABASE_URL = if ($env:SUPABASE_URL) { $env:SUPABASE_URL } else { $env:NEXT_PUBLIC_SUPABASE_URL }
$SUPABASE_SERVICE_KEY = $env:SUPABASE_SERVICE_KEY

Write-Host ""

# Validate environment variables
if (-not $SUPABASE_URL) {
    Write-Host "❌ Error: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL not found" -ForegroundColor Red
    Write-Host "   Please set it in your src\.env.local file" -ForegroundColor Yellow
    exit 1
}

if (-not $SUPABASE_SERVICE_KEY) {
    Write-Host "❌ Error: SUPABASE_SERVICE_KEY not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Please add SUPABASE_SERVICE_KEY to your src\.env.local file:" -ForegroundColor Yellow
    Write-Host "   SUPABASE_SERVICE_KEY=your-service-role-key-here" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   You can find your Service Role Key in:" -ForegroundColor Yellow
    Write-Host "   Supabase Dashboard → Settings → API → Service Role Key" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Check if migrations directory exists
if (-not (Test-Path $migrationsDir)) {
    Write-Host "❌ Error: Migrations directory not found at: $migrationsDir" -ForegroundColor Red
    exit 1
}

# Get all migration files
$migrationFiles = Get-ChildItem -Path $migrationsDir -Filter "*.sql" | Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    Write-Host "⚠️  No migration files found in: $migrationsDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "📝 Found $($migrationFiles.Count) migration(s):" -ForegroundColor Green
Write-Host ""
for ($i = 0; $i -lt $migrationFiles.Count; $i++) {
    Write-Host "   $($i + 1). $($migrationFiles[$i].Name)" -ForegroundColor White
}
Write-Host ""

# Display options
Write-Host "Choose an option:" -ForegroundColor Cyan
Write-Host "  1. Display all migrations (to copy to Supabase SQL Editor)"
Write-Host "  2. Save all migrations to a single file"
Write-Host "  3. Open Supabase SQL Editor in browser"
Write-Host "  4. Exit"
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "=" -ForegroundColor Cyan -NoNewline
        Write-Host ("=" * 79) -ForegroundColor Cyan
        Write-Host "COPY THESE MIGRATIONS TO SUPABASE SQL EDITOR" -ForegroundColor Yellow
        Write-Host ("=" * 80) -ForegroundColor Cyan
        Write-Host ""

        foreach ($file in $migrationFiles) {
            $content = Get-Content $file.FullName -Raw
            Write-Host "-- ╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
            Write-Host "-- ║  Migration: $($file.Name.PadRight(45)) ║" -ForegroundColor Green
            Write-Host "-- ╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
            Write-Host ""
            Write-Host $content -ForegroundColor White
            Write-Host ""
            Write-Host ""
        }

        Write-Host ("=" * 80) -ForegroundColor Cyan
        Write-Host "✅ All migrations displayed above" -ForegroundColor Green
        Write-Host "   Copy them to Supabase SQL Editor and run them in order." -ForegroundColor Yellow
        Write-Host ""
    }

    "2" {
        $outputFile = Join-Path $projectRoot "combined-migrations.sql"
        Write-Host ""
        Write-Host "📝 Creating combined migration file..." -ForegroundColor Cyan

        $combinedContent = "-- Combined Migrations for Pholio`n"
        $combinedContent += "-- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
        $combinedContent += "-- Total migrations: $($migrationFiles.Count)`n"
        $combinedContent += "`n"

        foreach ($file in $migrationFiles) {
            $content = Get-Content $file.FullName -Raw
            $combinedContent += "-- ╔════════════════════════════════════════════════════════════╗`n"
            $combinedContent += "-- ║  Migration: $($file.Name.PadRight(45)) ║`n"
            $combinedContent += "-- ╚════════════════════════════════════════════════════════════╝`n"
            $combinedContent += "`n"
            $combinedContent += $content
            $combinedContent += "`n`n"
        }

        Set-Content -Path $outputFile -Value $combinedContent -Encoding UTF8

        Write-Host "✅ Combined migrations saved to: $outputFile" -ForegroundColor Green
        Write-Host ""
        Write-Host "   You can now copy this file's content to Supabase SQL Editor" -ForegroundColor Yellow
        Write-Host ""

        # Ask if user wants to open the file
        $openFile = Read-Host "Open the file now? (y/n)"
        if ($openFile -eq "y" -or $openFile -eq "Y") {
            Start-Process notepad.exe -ArgumentList $outputFile
        }
    }

    "3" {
        if ($SUPABASE_URL) {
            $dashboardUrl = $SUPABASE_URL -replace '/rest/v1', ''
            $sqlEditorUrl = "$dashboardUrl/project/_/sql"

            Write-Host ""
            Write-Host "🌐 Opening Supabase SQL Editor in browser..." -ForegroundColor Cyan
            Write-Host "   URL: $sqlEditorUrl" -ForegroundColor Gray

            Start-Process $sqlEditorUrl

            Write-Host ""
            Write-Host "   After the browser opens:" -ForegroundColor Yellow
            Write-Host "   1. Copy the migration SQL (run this script again and choose option 1 or 2)" -ForegroundColor White
            Write-Host "   2. Paste it into the SQL Editor" -ForegroundColor White
            Write-Host "   3. Click 'Run' to execute" -ForegroundColor White
            Write-Host ""
        } else {
            Write-Host "❌ Could not determine Supabase URL" -ForegroundColor Red
        }
    }

    "4" {
        Write-Host "👋 Exiting..." -ForegroundColor Gray
        exit 0
    }

    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📚 Documentation: See API-SETUP.md for more information" -ForegroundColor Cyan
Write-Host ""
