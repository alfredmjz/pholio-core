// Unified Transaction System Types
// Shared types for creating transactions that update both budget and accounts

import type { TransactionType } from "@/app/accounts/types";

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
	type: "income" | "expense" | "transfer";

	// Budget tracking (optional - can be uncategorized)
	categoryId?: string | null;

	// Account tracking (optional - budget-only transactions allowed)
	accountId?: string | null;
	fromAccountId?: string | null; // For transfers (Source)
	toAccountId?: string | null; // For transfers (Destination)
	transactionType?: TransactionType; // deposit, withdrawal, payment, etc.

	/**
	 * Explicit opt-in that lets a transaction reduce a liability below zero (overpayment).
	 * It only bypasses the remaining-debt cap, never the asset balance or credit-limit caps.
	 */
	allowOverpayment?: boolean;

	// Optional source override
	source?: string;
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
