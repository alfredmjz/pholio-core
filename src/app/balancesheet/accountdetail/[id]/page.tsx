import { redirect } from "next/navigation";
import { getAccountById, getAccountTransactions, getAccounts } from "../../actions";
import { getAccountContributionSummary } from "@/lib/actions/contribution-actions";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { AccountDetailClient } from "./AccountDetailClient";

interface AccountDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
	const { id } = await params;

	const [account, transactions, allAccounts, sampleMode, contribution] = await Promise.all([
		getAccountById(id),
		getAccountTransactions(id),
		getAccounts(),
		isSampleDataMode(),
		getAccountContributionSummary(id),
	]);

	// Account was deleted (or never existed) — send the user back to the parent page.
	// In sample-data mode the account may exist only in the browser's demo store (created
	// during the demo session), so the client resolves it and redirects if it is missing there too.
	if (!account && !sampleMode) {
		redirect("/balancesheet");
	}

	// Filter out current account from "other accounts"
	const otherAccounts = allAccounts.filter((acc) => acc.id !== id);

	return (
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
			<AccountDetailClient
				accountId={id}
				account={account}
				transactions={transactions}
				otherAccounts={otherAccounts}
				contribution={contribution}
			/>
		</div>
	);
}
