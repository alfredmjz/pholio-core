import { processGlobalMonthlyInterest } from "@/app/balancesheet/actions";
import { Logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Vercel Cron handler for monthly interest processing. */
export async function GET(request: Request) {
	const authHeader = request.headers.get("authorization");

	if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	} else if (!process.env.CRON_SECRET) {
		Logger.warn("CRON_SECRET is not set — endpoint running without authorization");
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
