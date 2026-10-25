import { NextResponse } from "next/server";
import { Logger } from "@/lib/logger";
import { sendDueReminders } from "@/lib/reminder-jobs";

export const dynamic = "force-dynamic";

/** Vercel Cron handler for the daily reminder emails. */
export async function GET(request: Request) {
	// Fail closed: without a secret anyone could make Pholio email every opted-in user.
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		Logger.error("CRON_SECRET is not set; refusing to send reminders");
		return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
	}

	if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return NextResponse.json({ message: "Sample data: no reminders sent", users: 0, emailed: 0, failed: 0 });
	}

	try {
		const result = await sendDueReminders(new URL(request.url).origin);
		Logger.info("Sent reminders", result);
		return NextResponse.json({ message: "Success", ...result });
	} catch (error) {
		Logger.error("Reminder job failed", { error });
		return NextResponse.json({ error: "Failed to send reminders" }, { status: 500 });
	}
}
