import type { DataContext } from "@/lib/data-context.server";
import { getAccountsForSelector } from "@/lib/actions/unified-transaction-actions";
import { getAllocationContributions } from "@/lib/actions/contribution-actions";
import { allocationStore } from "./allocation-store";
import type { AllocationPageData } from "./types";

/** The page's catch-up refetch: summary, transactions, accounts and contributions in one request. */
export async function loadAllocationPageData(
	ctx: DataContext,
	allocationId: string | null,
	year: number,
	month: number
): Promise<AllocationPageData> {
	const store = allocationStore(ctx);
	const [summary, transactions, accounts, contributions] = await Promise.all([
		allocationId ? store.getSummary(allocationId) : null,
		store.listTransactionsForMonth(year, month),
		getAccountsForSelector(),
		getAllocationContributions(year, month),
	]);
	return { summary, transactions, accounts, contributions };
}
