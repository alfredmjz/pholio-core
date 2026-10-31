import { NextResponse } from "next/server";
import { postDueAccountCharges } from "@/lib/account-charges-job";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Vercel Cron handler for the daily account charges (monthly and yearly fees). */
export async function GET(request: Request) {
	// Fail closed: without a secret anyone could post fees on every account.
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		Logger.error("CRON_SECRET is not set; refusing to post account charges");
		return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
	}

	if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") {
		return NextResponse.json({ message: "Sample data: no charges posted", posted: 0 });
	}

	const result = await postDueAccountCharges();
	if (!result.success) {
		Logger.error(`Failed to post account charges: ${result.error}`);
		return NextResponse.json({ error: result.error }, { status: 500 });
	}
	Logger.info(`Posted ${result.posted} account charges`);
	return NextResponse.json({ message: "Success", posted: result.posted });
}
