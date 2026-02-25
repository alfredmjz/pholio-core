import { processGlobalMonthlyInterest } from "@/app/balancesheet/actions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	// Verify Vercel Cron Secret for authorization
	const authHeader = request.headers.get("authorization");

	// In development or if CRON_SECRET is not set, we might bypass, but it's safer to always require it
	// For Vercel, the authorization header is sent as `Bearer <CRON_SECRET>`
	if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	} else if (!process.env.CRON_SECRET) {
		console.warn("CRON_SECRET is not set. The endpoint is running without authorization.");
	}

	console.log(`[CRON] Starting global monthly interest processing at ${new Date().toISOString()}`);

	const result = await processGlobalMonthlyInterest();

	if (result.success) {
		console.log(`[CRON] Successfully processed interest for ${result.processed} accounts.`);
		return NextResponse.json({ message: "Success", processed: result.processed });
	} else {
		console.error(`[CRON] Failed to process interest: ${result.error}`);
		return NextResponse.json({ error: result.error }, { status: 500 });
	}
}
