import { redirect } from "next/navigation";
import { getTimezone } from "@/app/settings/actions";
import { getAccountContributionSummary } from "@/lib/actions/contribution-actions";
import { formatDateString, getTodayDateString } from "@/lib/date-utils";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { getDemoNow } from "@/mock-data/demo-date";
import { getAccountById, getAccountHistory, getAccountTransactions, getAccounts, getRecurringForAccount } from "../actions";
import type { BalancePoint } from "../account-insights";
import { AccountDetailClient } from "./AccountDetailClient";

interface AccountDetailPageProps {
	params: Promise<{ id: string }>;
}

export const metadata = {
	title: "Account | Pholio",
};

/** How many recorded balances the balance line draws. */
const HISTORY_LIMIT = 180;

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
	const { id } = await params;

	const [account, transactions, allAccounts, sampleMode, contribution, historyRows, timezone, recurring] = await Promise.all([
		getAccountById(id),
		getAccountTransactions(id),
		getAccounts(),
		isSampleDataMode(),
		getAccountContributionSummary(id),
		getAccountHistory(id, HISTORY_LIMIT).catch(() => []),
		getTimezone(),
		getRecurringForAccount(id),
	]);

	// Account was deleted (or never existed) — send the user back to the parent page.
	// In sample-data mode the account may exist only in the browser's demo store (created
	// during the demo session), so the client resolves it and redirects if it is missing there too.
	if (!account && !sampleMode) {
		redirect("/accounts");
	}

	const today = sampleMode ? formatDateString(getDemoNow()) : getTodayDateString(timezone ?? undefined);
	const history: BalancePoint[] = historyRows
		.map((row) => ({ date: String(row.recorded_at).slice(0, 10), balance: Number(row.balance) }))
		.sort((a, b) => a.date.localeCompare(b.date));
	const otherAccounts = allAccounts.filter((acc) => acc.id !== id);

	return (
		<AccountDetailClient
			accountId={id}
			account={account}
			transactions={transactions}
			otherAccounts={otherAccounts}
			contribution={contribution}
			history={history}
			today={today}
			recurring={recurring}
		/>
	);
}
