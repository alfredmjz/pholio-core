import { ActionError } from "@/lib/action-result";
import type { DataContext } from "@/lib/data-context.server";
import { Logger } from "@/lib/logger";
import { getTodayDateString } from "@/lib/date-utils";
import { balanceIncreaseDeposit } from "@/lib/balance-deposit";
import { accountStore, type AccountStore } from "@/app/accounts/account-store";
import type {
	Account,
	AccountTypeCode,
	AccountTypeMigrationItem,
	AccountTypeMigrationUpdate,
	AccountWithType,
	CreateAccountInput,
	UpdateAccountInput,
} from "@/app/accounts/types";

const ACCOUNT_NOT_FOUND = "That account no longer exists.";

async function attempt<T>(run: () => Promise<T>, message: string): Promise<T> {
	try {
		return await run();
	} catch (error) {
		Logger.error(message, { error });
		throw new ActionError("failed", message);
	}
}

/** Ledgers a balance increase on a room-tracked account as a deposit so contribution room counts it. */
async function recordBalanceDeposit(
	store: AccountStore,
	accountId: string,
	tracksRoom: boolean | null,
	previousBalance: number,
	newBalance: number
) {
	const amount = balanceIncreaseDeposit(Boolean(tracksRoom), Number(previousBalance), Number(newBalance));
	if (amount === null) return;

	try {
		await store.insertDeposit(accountId, amount, getTodayDateString());
	} catch (error) {
		Logger.error("Error recording balance deposit", { error });
	}
}

export async function createAccount(ctx: DataContext, input: CreateAccountInput): Promise<AccountWithType> {
	const store = accountStore(ctx);
	const account = await attempt(
		() => store.create(input),
		"Couldn't create the account. Check the details and try again."
	);
	await recordBalanceDeposit(store, account.id, account.track_contribution_room, 0, account.current_balance);
	return account;
}

export async function updateAccount(ctx: DataContext, id: string, input: UpdateAccountInput): Promise<Account> {
	const store = accountStore(ctx);
	const before = input.current_balance === undefined ? null : await store.getBalance(id);

	const account = await attempt(() => store.update(id, input), "Couldn't save the account. Please try again.");
	if (!account) throw new ActionError("not_found", ACCOUNT_NOT_FOUND);

	if (before !== null) {
		await recordBalanceDeposit(store, id, account.track_contribution_room, before, account.current_balance);
	}
	return account;
}

export async function deleteAccount(ctx: DataContext, id: string): Promise<void> {
	const removed = await attempt(() => accountStore(ctx).remove(id), "Couldn't delete the account. Please try again.");
	if (!removed) throw new ActionError("not_found", ACCOUNT_NOT_FOUND);
}

export async function reorderAccounts(
	ctx: DataContext,
	orders: { id: string; display_order: number }[]
): Promise<void> {
	await attempt(() => accountStore(ctx).setDisplayOrder(orders), "Couldn't save the new order. Try dragging it again.");
}

/** Suggestion only - derived from the retired type's stored category, never from its name. */
export function suggestCodeForLegacyCategory(category?: string | null): AccountTypeCode {
	switch (category) {
		case "investment":
		case "retirement":
			return "investment";
		case "credit":
			return "credit_card";
		case "debt":
			return "loan";
		case "other":
		case "property":
			return "other";
		default:
			return "chequing";
	}
}

/**
 * Accounts whose type was retired by migration 006 (or never received a stable `code`).
 * These need the owner to pick a new type through the guided migration dialog.
 */
export function accountsNeedingTypeMigration(accounts: AccountWithType[]): AccountTypeMigrationItem[] {
	return accounts
		.filter((account) => !account.account_type?.is_active || !account.account_type?.code)
		.map((account) => ({
			account,
			suggestedCode: suggestCodeForLegacyCategory(account.account_type?.category),
		}));
}

/** Applies the owner's type choices. Nothing is changed automatically; the UI sends an explicit selection per account. */
export async function migrateAccountTypes(ctx: DataContext, updates: AccountTypeMigrationUpdate[]): Promise<void> {
	const store = accountStore(ctx);
	for (const update of updates) {
		await attempt(
			() => store.setType(update.accountId, update.typeId, update.fieldVisibility),
			"Could not update every account. Please try again."
		);
	}
}
