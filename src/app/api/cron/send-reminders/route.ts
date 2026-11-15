import { NextResponse } from "next/server";
import { withCronAuth } from "@/lib/cron-auth";
import { Logger } from "@/lib/logger";
import { sendDueReminders } from "@/lib/reminder-jobs";

export const dynamic = "force-dynamic";

/** Vercel Cron handler for the daily reminder emails. */
export const GET = withCronAuth("send reminders", async (request) => {
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
});
