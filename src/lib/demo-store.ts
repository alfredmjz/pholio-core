"use client";

import { create } from "zustand";
import { sampleAccounts } from "@/mock-data/balancesheet";
import { getSampleRecentTransactions } from "@/mock-data/dashboard";
import type { AccountWithType } from "@/app/balancesheet/types";
import type { Transaction } from "@/app/dashboard/types";

interface DemoStore {
	accounts: AccountWithType[];
	transactions: Transaction[];
	addAccount: (account: AccountWithType) => void;
	addTransaction: (transaction: Transaction) => void;
	updateAccountBalance: (id: string, balance: number) => void;
	reset: () => void;
}

const seedAccounts = [...sampleAccounts];
const createSeedTransactions = (): Transaction[] => getSampleRecentTransactions();

/**
 * In-memory store backing demo mode.
 *
 * Demo mode is read-only against the server: reads serve static sample data and
 * mutations no-op. This store lets those mutations be reflected in the UI for the
 * duration of the session. State resets on a full page reload (and on `reset()`,
 * which the "Try the demo" entry point calls).
 */
export const useDemoStore = create<DemoStore>((set) => ({
	accounts: seedAccounts,
	transactions: createSeedTransactions(),
	addAccount: (account) => set((state) => ({ accounts: [...state.accounts, account] })),
	addTransaction: (transaction) => set((state) => ({ transactions: [transaction, ...state.transactions] })),
	updateAccountBalance: (id, balance) =>
		set((state) => ({
			accounts: state.accounts.map((account) => (account.id === id ? { ...account, current_balance: balance } : account)),
		})),
	reset: () => set({ accounts: [...seedAccounts], transactions: createSeedTransactions() }),
}));
