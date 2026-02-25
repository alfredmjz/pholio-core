"use client";

import type { AccountWithType, AccountTransaction } from "../../../types";
import { AssetPerformance } from "./AssetPerformance";
import { CreditCardPerformance } from "./CreditCardPerformance";
import { LoanPerformance } from "./LoanPerformance";
import { BankPerformance } from "./BankPerformance";

interface PerformanceCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

export function PerformanceCard({ account, transactions, formatCurrency }: PerformanceCardProps) {
	const { account_type } = account;
	const { class: accountClass, category, name } = account_type;

	// Determine which performance card to show
	if (accountClass === "liability") {
		if (category === "credit") {
			return <CreditCardPerformance account={account} transactions={transactions} formatCurrency={formatCurrency} />;
		}
		// Default liability to Loan/Debt view
		return <LoanPerformance account={account} transactions={transactions} formatCurrency={formatCurrency} />;
	}

	// Assets
	if (category === "banking") {
		// Special case for Savings accounts if distinguishable by name, otherwise banking default
		if (name.toLowerCase().includes("savings")) {
			return <AssetPerformance account={account} transactions={transactions} formatCurrency={formatCurrency} />;
		}
		return <BankPerformance account={account} transactions={transactions} formatCurrency={formatCurrency} />;
	}

	// Default Asset to Investment/Growth view
	return <AssetPerformance account={account} transactions={transactions} formatCurrency={formatCurrency} />;
}
