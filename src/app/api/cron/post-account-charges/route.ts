import { NextResponse } from "next/server";
import { postDueAccountCharges } from "@/lib/account-charges-job";
import { withCronAuth } from "@/lib/cron-auth";
import { Logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Vercel Cron handler for the daily account charges (monthly and yearly fees). */
export const GET = withCronAuth("post account charges", async () => {
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
});
