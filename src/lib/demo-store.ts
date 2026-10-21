"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { sampleAccounts, getSampleAccountTransactions } from "@/mock-data/balancesheet";
import { getSampleRecentTransactions } from "@/mock-data/dashboard";
import type { AccountWithType, AccountTransaction, TransactionType } from "@/app/balancesheet/types";
import type { Transaction } from "@/app/dashboard/types";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import { calculateSignedDelta, resolveAccountTransactionType } from "@/lib/account-validation-utils";

/** A ledger row to record against one account; the store fills in the id and metadata. */
export interface DemoLedgerEntry {
	account_id: string;
	amount: number;
	transaction_type: TransactionType;
	description: string;
	transaction_date: string;
}

interface DemoStore {
	accounts: AccountWithType[];
	transactions: Transaction[];
	/** Per-account ledger (the `account_transactions` rows the account detail page shows). */
	accountTransactions: AccountTransaction[];
	addAccount: (account: AccountWithType) => void;
	updateAccount: (account: AccountWithType) => void;
	removeAccount: (id: string) => void;
	addTransaction: (transaction: Transaction) => void;
	/** Appends ledger rows and moves each account's balance by the row's signed amount. */
	recordAccountTransactions: (entries: DemoLedgerEntry[]) => void;
	updateAccountBalance: (id: string, balance: number) => void;
	reset: () => void;
}

const createSeedState = () => ({
	accounts: [...sampleAccounts],
	transactions: getSampleRecentTransactions(),
	accountTransactions: Object.values(getSampleAccountTransactions()).flat(),
});

// Demo balances are plain numbers; keep them at cent precision so float error never shows.
const roundToCents = (value: number) => Math.round(value * 100) / 100;

export const createDemoId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * In-memory store backing demo mode.
 *
 * Demo mode is read-only against the server: reads serve static sample data and
 * mutations no-op. This store lets those mutations be reflected in the UI for the
 * duration of the session. It is kept in `sessionStorage`, so it survives reloads and
 * direct links within the tab, and is cleared by `reset()`, which the "Try the demo"
 * entry point calls.
 */
export const useDemoStore = create<DemoStore>()(
	persist(
		(set) => ({
			...createSeedState(),
			addAccount: (account) => set((state) => ({ accounts: [...state.accounts, account] })),
			updateAccount: (account) =>
				set((state) => ({
					accounts: state.accounts.map((existing) => (existing.id === account.id ? account : existing)),
				})),
			removeAccount: (id) =>
				set((state) => ({
					accounts: state.accounts.filter((account) => account.id !== id),
					accountTransactions: state.accountTransactions.filter((transaction) => transaction.account_id !== id),
				})),
			addTransaction: (transaction) => set((state) => ({ transactions: [transaction, ...state.transactions] })),
			recordAccountTransactions: (entries) =>
				set((state) => {
					const now = new Date().toISOString();
					const rows: AccountTransaction[] = entries.map((entry) => ({
						...entry,
						id: createDemoId("demo-acct-txn"),
						user_id: "sample-user",
						linked_allocation_transaction_id: null,
						created_at: now,
					}));

					return {
						accountTransactions: [...rows, ...state.accountTransactions],
						accounts: state.accounts.map((account) => {
							const delta = rows
								.filter((row) => row.account_id === account.id)
								.reduce((sum, row) => sum + row.amount, 0);
							return delta === 0
								? account
								: { ...account, current_balance: roundToCents(account.current_balance + delta) };
						}),
					};
				}),
			updateAccountBalance: (id, balance) =>
				set((state) => ({
					accounts: state.accounts.map((account) =>
						account.id === id ? { ...account, current_balance: balance } : account
					),
				})),
			reset: () => set(createSeedState()),
		}),
		{
			name: "pholio-demo-store",
			storage: createJSONStorage(() => sessionStorage),
			partialize: (state) => ({
				accounts: state.accounts,
				transactions: state.transactions,
				accountTransactions: state.accountTransactions,
			}),
		}
	)
);

/**
 * Records the account side of a unified transaction in the demo store: the ledger rows
 * `createUnifiedTransaction` would write (one per tagged account, two for a transfer) and
 * the matching balance changes. Uses the same sign helpers as the server write path.
 */
export function recordDemoUnifiedTransaction(input: UnifiedTransactionInput) {
	const { accounts, recordAccountTransactions } = useDemoStore.getState();
	const findAccount = (id?: string | null) => (id ? accounts.find((account) => account.id === id) : undefined);
	const entries: DemoLedgerEntry[] = [];

	if (input.type === "transfer") {
		const from = findAccount(input.fromAccountId);
		const to = findAccount(input.toAccountId);
		if (from) {
			entries.push({
				account_id: from.id,
				amount: calculateSignedDelta(from, "transfer", undefined, input.amount),
				transaction_type: "transfer",
				description: input.description || `Transfer to ${to?.name ?? "account"}`,
				transaction_date: input.date,
			});
		}
		if (to) {
			entries.push({
				account_id: to.id,
				amount: -calculateSignedDelta(to, "transfer", undefined, input.amount),
				transaction_type: "transfer",
				description: input.description || `Transfer from ${from?.name ?? "account"}`,
				transaction_date: input.date,
			});
		}
	} else {
		const account = findAccount(input.accountId);
		if (account) {
			entries.push({
				account_id: account.id,
				amount: calculateSignedDelta(account, input.type, input.transactionType, input.amount),
				transaction_type: resolveAccountTransactionType(account, input.type, input.transactionType) as TransactionType,
				description: input.description,
				transaction_date: input.date,
			});
		}
	}

	if (entries.length > 0) recordAccountTransactions(entries);
}
