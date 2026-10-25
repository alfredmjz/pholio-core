// Runs a cron route against the local dev server the way Vercel does, with the CRON_SECRET from
// src/.env.local (Bun loads it). Usage: bun run cron send-reminders
// The job acts on every user in the database the app is connected to.

async function runCron() {
	const job = process.argv[2] ?? "send-reminders";
	const secret = process.env.CRON_SECRET;
	const baseUrl = process.env.CRON_BASE_URL ?? "http://localhost:3000";

	if (!secret) {
		console.error("CRON_SECRET is not set. Add it to src/.env.local.");
		process.exit(1);
	}

	const response = await fetch(`${baseUrl}/api/cron/${job}`, { headers: { Authorization: `Bearer ${secret}` } });
	console.log(`${response.status} ${await response.text()}`);
	process.exit(response.ok ? 0 : 1);
}

runCron();
