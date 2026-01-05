"use client";

import { useState, useEffect } from "react";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { updateAccount } from "../actions";
import { formatFullDate } from "@/lib/date-utils";

import { EmptyAccountState, AccountHeader, AccountStats, AccountNotes, TransactionHistory } from "./account-detail";

import type { AccountWithType, AccountTransaction } from "../types";

interface AccountDetailPanelProps {
	account: AccountWithType | null;
	transactions: AccountTransaction[];
	isLoadingTransactions?: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onRecordTransaction: () => void;
	onAdjustBalance: () => void;
}

/**
 * Main account detail panel component that displays account information,
 * statistics, notes, and transaction history.
 */
export function AccountDetailPanel({
	account,
	transactions,
	isLoadingTransactions = false,
	onDelete,
	onRecordTransaction,
	onAdjustBalance,
}: Omit<AccountDetailPanelProps, "onEdit">) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValues, setEditValues] = useState({
		name: "",
		institution: "",
		icon: null as string | null,
		notes: "",
	});

	// Initialize edit values when account changes or editing starts
	useEffect(() => {
		if (account) {
			setEditValues({
				name: account.name,
				institution: account.institution || "",
				icon: account.icon,
				notes: account.notes || "",
			});
		}
	}, [account, isEditing]);

	// Utility formatters
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 2,
		}).format(amount);
	};

	// Handle save action
	const handleSave = async () => {
		if (!account) return;

		try {
			const result = await updateAccount(account.id, {
				name: editValues.name,
				institution: editValues.institution || null,
				icon: editValues.icon,
				notes: editValues.notes || null,
			});
			if (result) {
				toast.success("Account updated");
				setIsEditing(false);
			} else {
				toast.error("Update Failed", {
					description: "Failed to update account details. Please try again.",
				});
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
			toast.error("Update Error", {
				description: errorMessage,
			});
		}
	};

	// Show empty state if no account selected
	if (!account) {
		return <EmptyAccountState />;
	}

	const accountClass = account.account_type?.class;
	const progress =
		account.target_balance && accountClass === "asset"
			? (account.current_balance / account.target_balance) * 100
			: account.target_balance && accountClass === "liability"
				? ((account.target_balance - account.current_balance) / account.target_balance) * 100
				: null;

	return (
		<TooltipProvider>
			<Card className="h-full flex flex-col overflow-hidden border-none shadow-lg">
				{/* Header Section */}
				<div className="flex flex-col gap-6 p-6">
					<AccountHeader
						account={account}
						isEditing={isEditing}
						editValues={editValues}
						accountClass={accountClass}
						onEditValuesChange={setEditValues}
						onSave={handleSave}
						onCancel={() => setIsEditing(false)}
						onStartEdit={() => setIsEditing(true)}
						onDelete={onDelete}
					/>

					<Separator />

					{/* Stats Row */}
					<AccountStats
						account={account}
						accountClass={accountClass}
						progress={progress}
						formatCurrency={formatCurrency}
					/>

					{/* Notes */}
					<AccountNotes
						account={account}
						isEditing={isEditing}
						notes={editValues.notes}
						onNotesChange={(notes) => setEditValues({ ...editValues, notes })}
					/>
				</div>

				<Separator />

				{/* Transaction History */}
				<TransactionHistory
					transactions={transactions}
					isLoading={isLoadingTransactions}
					accountClass={accountClass}
					onRecordTransaction={onRecordTransaction}
					onAdjustBalance={onAdjustBalance}
					formatCurrency={formatCurrency}
					formatDate={formatFullDate}
				/>
			</Card>
		</TooltipProvider>
	);
}
