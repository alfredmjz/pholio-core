import { NextResponse } from "next/server";
import { z } from "zod";
import { getReadContext } from "@/lib/data-context.server";
import { idSchema } from "@/lib/action-schemas";
import { loadAllocationPageData } from "@/app/allocations/page-data.server";

export const dynamic = "force-dynamic";

const querySchema = z.object({
	year: z.coerce.number().int().min(1970).max(9999),
	month: z.coerce.number().int().min(1).max(12),
	allocationId: idSchema.optional(),
});

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The Allocations page's focus refetch. A GET route rather than a server action, because Next
 * runs server actions one at a time and a refetch in the queue would hold up the user's saves.
 */
export async function GET(request: Request) {
	const ctx = await getReadContext();
	if (!ctx) return NextResponse.json({ error: "Please sign in again." }, { status: 401, headers: NO_STORE });

	const params = new URL(request.url).searchParams;
	const query = querySchema.safeParse({
		year: params.get("year") ?? undefined,
		month: params.get("month") ?? undefined,
		allocationId: params.get("allocationId") || undefined,
	});
	if (!query.success) {
		return NextResponse.json({ error: "Invalid year, month or allocationId." }, { status: 400, headers: NO_STORE });
	}

	const { year, month, allocationId } = query.data;
	const data = await loadAllocationPageData(ctx, allocationId ?? null, year, month);
	return NextResponse.json(data, { headers: NO_STORE });
}
