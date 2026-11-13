import { ActionError } from "@/lib/action-result";
import type { DataContext } from "@/lib/data-context.server";
import { Logger } from "@/lib/logger";
import {
	calculateSignedDelta,
	checkTransactionCaps,
	resolveAccountTransactionType,
} from "@/lib/account-validation-utils";
import type { AccountWithType, TransactionType } from "@/app/accounts/types";
import type { UnifiedTransactionInput } from "@/lib/types/unified-transaction";
import { transactionStore, type SavedBudgetRow, type TransactionStore } from "@/lib/actions/transaction-store";

export interface CreatedTransaction {
	allocationTransactionId: string;
	accountTransactionId?: string;
}

export interface LedgerEntryUpdate {
	description?: string;
	amount?: number;
	transactionDate?: string;
	transactionType?: TransactionType;
}

const MISSING_TRANSFER_ACCOUNT = "Please select both source and destination accounts for the transfer";
const SAME_TRANSFER_ACCOUNT = "Source and destination accounts must be different";
const TRANSFER_ACCOUNT_NOT_FOUND = "One or both selected accounts were not found";
const ACCOUNT_NOT_FOUND = "Account not found";
const TRANSACTION_NOT_FOUND = "That transaction no longer exists.";

/** Rejects with the first cap violation, worded exactly as the transaction dialogs show it. */
export function assertWithinCaps(params: Parameters<typeof checkTransactionCaps>[0]): void {
	const result = checkTransactionCaps(params);
	if (!result.isValid) throw new ActionError("invalid_input", result.violations[0].message);
}

/** The account as it stood before a saved row moved it, so an edit is capped without its own amount. */
export function accountWithoutRow(account: AccountWithType, row: SavedBudgetRow): AccountWithType {
	const own = row.legs.filter((leg) => leg.accountId === account.id).reduce((sum, leg) => sum + leg.amount, 0);
	return own === 0 ? account : { ...account, current_balance: Number(account.current_balance) - own };
}

async function step<T>(run: () => Promise<T>, message: string): Promise<T> {
	try {
		return await run();
	} catch (error) {
		Logger.error(message, { error });
		throw new ActionError("failed", message);
	}
}

async function undo(...actions: Array<() => Promise<void>>) {
	for (const action of actions) {
		try {
			await action();
		} catch (error) {
			Logger.error("Transaction rollback step failed", { error });
		}
	}
}

async function bestEffort(run: () => Promise<void>, message: string) {
	try {
		await run();
	} catch (error) {
		Logger.warn(message, { error });
	}
}

async function loadTransferAccounts(
	store: TransactionStore,
	fromId: string | null | undefined,
	toId: string | null | undefined
) {
	if (!fromId || !toId) throw new ActionError("invalid_input", MISSING_TRANSFER_ACCOUNT);
	if (fromId === toId) throw new ActionError("invalid_input", SAME_TRANSFER_ACCOUNT);
	const [fromAccount, toAccount] = await Promise.all([store.getAccount(fromId), store.getAccount(toId)]);
	if (!fromAccount || !toAccount) throw new ActionError("not_found", TRANSFER_ACCOUNT_NOT_FOUND);
	return { fromAccount, toAccount };
}

async function loadAccount(store: TransactionStore, id: string) {
	const account = await store.getAccount(id);
	if (!account) throw new ActionError("not_found", ACCOUNT_NOT_FOUND);
	return account;
}

/**
 * Records a budget row and, when an account is tagged, its ledger row and balance change. A transfer
 * is one budget row plus a leg on each account. Balance and debt caps are checked against balances
 * read now, before anything is written.
 */
export async function createTransaction(ctx: DataContext, input: UnifiedTransactionInput): Promise<CreatedTransaction> {
	const store = transactionStore(ctx);
	if (input.type === "transfer") return createTransfer(store, input);

	const account = input.accountId ? await loadAccount(store, input.accountId) : null;
	if (account) {
		assertWithinCaps({
			intent: input.type,
			amount: Math.abs(input.amount),
			account,
			transactionType: input.transactionType,
			allowOverpayment: input.allowOverpayment,
		});
	}

	const budgetRowId = await step(
		() =>
			store.insertBudgetRow({
				categoryId: input.categoryId ?? null,
				name: input.description,
				amount: input.type === "income" ? input.amount : -Math.abs(input.amount),
				date: input.date,
				notes: input.notes || null,
				source: input.source || "manual",
			}),
		"Failed to create budget transaction"
	);
	if (!account) return { allocationTransactionId: budgetRowId };

	const txType = resolveAccountTransactionType(account, input.type, input.transactionType);
	const accountAmount = calculateSignedDelta(account, input.type, txType, input.amount);

	let ledgerRowId: string;
	try {
		ledgerRowId = await step(
			() =>
				store.insertLedgerRow({
					accountId: account.id,
					amount: accountAmount,
					transactionType: txType,
					description: input.description,
					date: input.date,
					linkedBudgetRowId: budgetRowId,
					isCashAdvance: input.type === "expense" && !!input.isCashAdvance,
				}),
			"Failed to create account transaction"
		);
	} catch (error) {
		await undo(() => store.deleteBudgetRow(budgetRowId));
		throw error;
	}

	try {
		await step(() => store.adjustBalance(account.id, accountAmount), "Failed to update account balance");
	} catch (error) {
		await undo(
			() => store.deleteBudgetRow(budgetRowId),
			() => store.deleteLedgerRow(ledgerRowId)
		);
		throw error;
	}

	await bestEffort(() => store.linkBudgetRow(budgetRowId, ledgerRowId), "Linking budget row to ledger row failed");
	return { allocationTransactionId: budgetRowId, accountTransactionId: ledgerRowId };
}

async function createTransfer(store: TransactionStore, input: UnifiedTransactionInput): Promise<CreatedTransaction> {
	const { fromAccount, toAccount } = await loadTransferAccounts(store, input.fromAccountId, input.toAccountId);
	const amount = Math.abs(input.amount);
	assertWithinCaps({ intent: "transfer", amount, fromAccount, toAccount, allowOverpayment: input.allowOverpayment });

	const budgetRowId = await step(
		() =>
			store.insertBudgetRow({
				categoryId: null,
				name: input.description,
				amount,
				date: input.date,
				notes: input.notes || null,
				source: "transfer",
			}),
		"Failed to create transfer transaction record"
	);

	const fromAmount = calculateSignedDelta(fromAccount, "transfer", undefined, amount);
	const toAmount = -calculateSignedDelta(toAccount, "transfer", undefined, amount);

	let fromLegId: string;
	try {
		fromLegId = await step(
			() =>
				store.insertLedgerRow({
					accountId: fromAccount.id,
					amount: fromAmount,
					transactionType: "transfer",
					description: input.description || `Transfer to ${toAccount.name}`,
					date: input.date,
					linkedBudgetRowId: budgetRowId,
				}),
			"Failed to process transfer from source account"
		);
	} catch (error) {
		await undo(() => store.deleteBudgetRow(budgetRowId));
		throw error;
	}

	try {
		await step(() => store.adjustBalance(fromAccount.id, fromAmount), "Failed to process transfer from source account");
	} catch (error) {
		await undo(
			() => store.deleteLedgerRow(fromLegId),
			() => store.deleteBudgetRow(budgetRowId)
		);
		throw error;
	}

	let toLegId: string;
	try {
		toLegId = await step(
			() =>
				store.insertLedgerRow({
					accountId: toAccount.id,
					amount: toAmount,
					transactionType: "transfer",
					description: input.description || `Transfer from ${fromAccount.name}`,
					date: input.date,
					linkedBudgetRowId: budgetRowId,
				}),
			"Failed to process transfer to destination account"
		);
		await step(() => store.adjustBalance(toAccount.id, toAmount), "Failed to process transfer to destination account");
	} catch (error) {
		await undo(
			() => store.adjustBalance(fromAccount.id, -fromAmount),
			() => store.deleteLedgerRow(fromLegId),
			() => store.deleteBudgetRow(budgetRowId)
		);
		throw error;
	}

	await bestEffort(() => store.linkTransferLegs(fromLegId, toLegId), "Optional transfer linking failed");
	await bestEffort(() => store.linkBudgetRow(budgetRowId, fromLegId), "Linking transfer budget row failed");
	return { allocationTransactionId: budgetRowId, accountTransactionId: fromLegId };
}

/**
 * Edits a budget row and every ledger leg it moved (update_unified_transaction). The new amount is
 * capped against each account as it stood before this row, and rows posted by a recurring
 * expense are never capped, matching the edit dialog.
 */
export async function updateTransaction(ctx: DataContext, id: string, input: UnifiedTransactionInput): Promise<void> {
	const store = transactionStore(ctx);
	const row = await store.getBudgetRow(id);
	if (!row) throw new ActionError("not_found", TRANSACTION_NOT_FOUND);

	const amount = Math.abs(input.amount);
	if (input.type === "transfer") {
		const { fromAccount, toAccount } = await loadTransferAccounts(
			store,
			input.fromAccountId ?? input.accountId,
			input.toAccountId
		);
		if (!row.recurringExpenseId) {
			assertWithinCaps({
				intent: "transfer",
				amount,
				fromAccount: accountWithoutRow(fromAccount, row),
				toAccount: accountWithoutRow(toAccount, row),
				allowOverpayment: input.allowOverpayment,
			});
		}
	} else if (input.accountId) {
		const account = await loadAccount(store, input.accountId);
		if (!row.recurringExpenseId) {
			assertWithinCaps({
				intent: input.type,
				amount,
				account: accountWithoutRow(account, row),
				transactionType: input.transactionType,
				allowOverpayment: input.allowOverpayment,
			});
		}
	}

	const updated = await store.updateUnified(id, { ...input });
	if (!updated) throw new ActionError("failed", "Couldn't update the transaction. Please try again.");
}

/** Deletes a budget row and reverses every ledger leg it moved (delete_unified_transaction). */
export async function deleteTransaction(ctx: DataContext, id: string): Promise<void> {
	const deleted = await transactionStore(ctx).deleteUnified(id);
	if (!deleted) throw new ActionError("not_found", TRANSACTION_NOT_FOUND);
}

/** Rows the database posts on its own; editing them is a correction, not new spending. */
const SYSTEM_POSTED_TYPES = ["fee", "interest"];

/**
 * Signed amount for an edited ledger row. A row whose type is unchanged keeps its direction, so
 * an incoming transfer leg or a refund is not flipped; a new type takes that type's direction.
 */
export function editedLedgerAmount(
	account: AccountWithType,
	existing: { amount: number; transaction_type: string },
	txType: string,
	inputAmount: number
): number {
	const abs = Math.abs(inputAmount);
	const keepsDirection = txType === existing.transaction_type || txType === "transfer";
	if (keepsDirection && existing.amount !== 0) return existing.amount < 0 ? -abs : abs;
	return calculateSignedDelta(account, "expense", txType, abs);
}

/**
 * Caps a ledger edit that makes the row move more money, against the account as it stood before
 * the row. Each direction maps to the transaction type the cap rules know.
 */
export function assertLedgerEditWithinCaps(
	account: AccountWithType,
	existingAmount: number,
	newAmount: number,
	txType: string
): void {
	const grows = Math.abs(newAmount) > Math.abs(existingAmount) || Math.sign(newAmount) !== Math.sign(existingAmount);
	if (!grows || newAmount === 0 || SYSTEM_POSTED_TYPES.includes(txType)) return;

	const isAsset = account.account_type?.class !== "liability";
	const capType = isAsset ? (newAmount < 0 ? "withdrawal" : "deposit") : newAmount < 0 ? "payment" : "adjustment";
	assertWithinCaps({
		intent: newAmount < 0 === isAsset ? "expense" : "income",
		amount: Math.abs(newAmount),
		account: { ...account, current_balance: Number(account.current_balance) - existingAmount },
		transactionType: capType,
	});
}

/**
 * Edits one ledger row from the account page: moves the balance by the difference and keeps a
 * linked budget row in step.
 */
export async function updateLedgerEntry(ctx: DataContext, id: string, input: LedgerEntryUpdate): Promise<void> {
	const store = transactionStore(ctx);
	const existing = await store.getLedgerRow(id);
	if (!existing) throw new ActionError("not_found", TRANSACTION_NOT_FOUND);
	const account = await loadAccount(store, existing.account_id);

	const txType = input.transactionType || existing.transaction_type;
	const newAmount =
		input.amount !== undefined ? editedLedgerAmount(account, existing, txType, input.amount) : existing.amount;
	assertLedgerEditWithinCaps(account, existing.amount, newAmount, txType);

	const balanceBefore = Number(account.current_balance);
	const balanceDiff = newAmount - existing.amount;
	if (balanceDiff !== 0) await store.setBalance(account.id, balanceBefore + balanceDiff);

	try {
		await store.updateLedgerRow(id, {
			...(input.description !== undefined && { description: input.description }),
			...(input.amount !== undefined && { amount: newAmount }),
			...(input.transactionDate !== undefined && { transaction_date: input.transactionDate }),
			...(input.transactionType !== undefined && { transaction_type: input.transactionType }),
		});
	} catch (error) {
		if (balanceDiff !== 0) await undo(() => store.setBalance(account.id, balanceBefore));
		throw error;
	}

	const budgetRowId = existing.linked_allocation_transaction_id;
	if (!budgetRowId) return;
	const patch = {
		...(input.description !== undefined && { name: input.description }),
		...(input.transactionDate !== undefined && { transaction_date: input.transactionDate }),
		// Budget amounts are signed: negative for money out.
		...(input.amount !== undefined && {
			amount: ["withdrawal", "payment"].includes(txType) ? -Math.abs(input.amount) : Math.abs(input.amount),
		}),
	};
	if (Object.keys(patch).length > 0) {
		await bestEffort(() => store.updateBudgetRow(budgetRowId, patch), "Updating linked budget row failed");
	}
}

/** Deletes one ledger row, reverses its balance change and removes a linked budget row. */
export async function deleteLedgerEntry(ctx: DataContext, id: string): Promise<void> {
	const store = transactionStore(ctx);
	const existing = await store.getLedgerRow(id);
	if (!existing) throw new ActionError("not_found", TRANSACTION_NOT_FOUND);

	const account = await store.getAccount(existing.account_id);
	if (account) await store.setBalance(account.id, Number(account.current_balance) - existing.amount);

	const budgetRowId = existing.linked_allocation_transaction_id;
	if (budgetRowId) await bestEffort(() => store.deleteBudgetRow(budgetRowId), "Deleting linked budget row failed");

	await store.deleteLedgerRow(id);
}
