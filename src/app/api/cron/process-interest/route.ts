import { processGlobalMonthlyInterest } from "@/lib/monthly-interest";
import { withCronAuth } from "@/lib/cron-auth";
import { Logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Vercel Cron handler for monthly interest processing. */
export const GET = withCronAuth("run monthly interest processing", async () => {
	Logger.info("Starting global monthly interest processing");

	const result = await processGlobalMonthlyInterest();

	if (result.success) {
		Logger.info(`Successfully processed interest for ${result.processed} accounts`);
		return NextResponse.json({ message: "Success", processed: result.processed });
	} else {
		Logger.error(`Failed to process interest: ${result.error}`);
		return NextResponse.json({ error: result.error }, { status: 500 });
	}
});
