import { processGlobalMonthlyInterest } from "@/lib/monthly-interest";
import { Logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Vercel Cron handler for monthly interest processing. */
export async function GET(request: Request) {
	// Fail closed: without a secret anyone could trigger a month of interest on every account.
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		Logger.error("CRON_SECRET is not set; refusing to run monthly interest processing");
		return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
	}

	if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	Logger.info("Starting global monthly interest processing");

	const result = await processGlobalMonthlyInterest();

	if (result.success) {
		Logger.info(`Successfully processed interest for ${result.processed} accounts`);
		return NextResponse.json({ message: "Success", processed: result.processed });
	} else {
		Logger.error(`Failed to process interest: ${result.error}`);
		return NextResponse.json({ error: result.error }, { status: 500 });
	}
}
