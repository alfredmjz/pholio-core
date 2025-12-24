import { notFound } from "next/navigation";
import { getAccountById, getAccountTransactions, getAccounts } from "../../actions";
import { AccountDetailClient } from "./AccountDetailClient";

interface AccountDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
	const { id } = await params;

	const [account, transactions, allAccounts] = await Promise.all([
		getAccountById(id),
		getAccountTransactions(id),
		getAccounts(),
	]);

	if (!account) {
		notFound();
	}

	// Filter out current account from "other accounts"
	const otherAccounts = allAccounts.filter((acc) => acc.id !== id);

	return (
		<div className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
			<AccountDetailClient account={account} transactions={transactions} otherAccounts={otherAccounts} />
		</div>
	);
}
