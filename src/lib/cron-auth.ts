import { NextResponse } from "next/server";
import { Logger } from "@/lib/logger";

/**
 * Wraps a Vercel Cron handler with the shared bearer-secret check. It fails closed: without a
 * secret anyone could trigger the job. `label` completes "refusing to ..." in the log.
 */
export function withCronAuth(label: string, handler: (request: Request) => Promise<Response>) {
	return async function GET(request: Request): Promise<Response> {
		const cronSecret = process.env.CRON_SECRET;
		if (!cronSecret) {
			Logger.error(`CRON_SECRET is not set; refusing to ${label}`);
			return NextResponse.json({ error: "Cron is not configured" }, { status: 500 });
		}

		if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		return handler(request);
	};
}
