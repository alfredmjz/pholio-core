// Unified Transaction System Types
// Shared types for creating transactions that update both budget and accounts

import type { CategoryType } from "@/app/allocations/types";
import type { TransactionType, AccountWithType } from "@/app/balancesheet/types";

/**
 * Input for creating a unified transaction
 * Updates both allocation budget AND account balance
 */
export interface UnifiedTransactionInput {
	// Core fields
	description: string;
	amount: number;
	date: string;
	notes?: string;

	// Type classification
	type: "income" | "expense";

	// Budget tracking (optional - can be uncategorized)
	categoryId?: string | null;

	// Account tracking (optional - budget-only transactions allowed)
	accountId?: string | null;
	transactionType?: TransactionType; // deposit, withdrawal, payment, etc.
}

/**
 * Response from creating a unified transaction
 */
export interface UnifiedTransactionResult {
	success: boolean;
	allocationTransactionId?: string;
	accountTransactionId?: string;
	error?: string;
}

/**
 * Suggested account for a category (based on category type)
 */
export interface SuggestedAccount {
	categoryId: string;
	accountId: string | null;
	account?: AccountWithType;
	reason: "linked_savings_goal" | "linked_debt_payment" | "none";
}
