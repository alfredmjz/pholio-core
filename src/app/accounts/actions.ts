"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getReadContext } from "@/lib/data-context.server";
import { defineAction } from "@/lib/define-action.server";
import { displayOrderSchema, idSchema, moneySchema } from "@/lib/action-schemas";
import * as accounts from "@/lib/domain/accounts";
import type { StatementLedgerRow } from "@/lib/credit-card-statement";
import { accountStore } from "./account-store";
import type { BalancePoint } from "./account-insights";

import type {
	AccountWithType,
	AccountType,
	AccountHistory,
	AccountTransaction,
	AccountFieldConfig,
	AccountTypeMigrationItem,
} from "./types";

const nullableText = z.string().nullish();
const nullableNumber = z.number().finite("Enter a valid number.").nullish();
const nullableDate = z.string().nullish();
const interestTypeSchema = z.enum(["simple", "compound", "none"]);
const contributionPlanSchema = z.enum(["tfsa", "rrsp", "fhsa", "resp", "other"]);
const fieldVisibilitySchema = z.custom<AccountFieldConfig>((value) => typeof value === "object" && value !== null);

const accountFields = {
	institution: nullableText,
	credit_limit: nullableNumber,
	original_amount: nullableNumber,
	interest_rate: nullableNumber,
	interest_type: interestTypeSchema.nullish(),
	loan_term_months: nullableNumber,
	payment_due_date: nullableNumber,
	statement_day: nullableNumber,
	statement_balance: nullableNumber,
	statement_balance_date: nullableDate,
	target_balance: nullableNumber,
	track_contribution_room: z.boolean().optional(),
	contribution_plan: contributionPlanSchema.nullish(),
	contribution_room: nullableNumber,
	contribution_room_as_of: nullableDate,
	annual_contribution_limit: nullableNumber,
	overdraft_protection: z.boolean().optional(),
	overdraft_limit: nullableNumber,
	overdraft_fee: nullableNumber,
	nsf_fee: nullableNumber,
	over_limit_fee: nullableNumber,
	overdraft_interest_rate: nullableNumber,
	notes: nullableText,
	color: nullableText,
	icon: nullableText,
	field_visibility: fieldVisibilitySchema.nullish(),
};

const createAccountSchema = z.object({
	...accountFields,
	name: z.string().trim().min(1, "Give the account a name."),
	account_type_id: idSchema,
	current_balance: moneySchema,
	currency: z.string().min(1).optional(),
	loan_start_date: nullableDate,
});

const updateAccountSchema = z.object({
	...accountFields,
	name: z.string().trim().min(1, "Give the account a name.").optional(),
	current_balance: moneySchema.optional(),
	display_order: z.number().int().optional(),
	is_active: z.boolean().optional(),
});

const typeMigrationSchema = z.array(
	z.object({ accountId: idSchema, typeId: idSchema, fieldVisibility: fieldVisibilitySchema.nullish() })
);

/**
 * Get all available account types (system + user-created)
 */
export async function getAccountTypes(): Promise<AccountType[]> {
	const ctx = await getReadContext();
	return ctx ? accountStore(ctx).listTypes() : [];
}

/**
 * Accounts whose type was retired by migration 006 (or never received a stable `code`).
 * These need the owner to pick a new type through the guided migration dialog.
 *
 * TODO(#99-cleanup): delete along with the banner/dialog once the result set is empty.
 */
export async function getAccountsNeedingTypeMigration(): Promise<AccountTypeMigrationItem[]> {
	const ctx = await getReadContext();
	if (!ctx) return [];
	return accounts.accountsNeedingTypeMigration(await accountStore(ctx).list());
}

export const migrateAccountTypes = defineAction("migrateAccountTypes", [typeMigrationSchema], async (ctx, updates) => {
	await accounts.migrateAccountTypes(ctx, updates);
	revalidatePath("/accounts");
	revalidatePath("/dashboard");
});

async function requireReadContext() {
	const ctx = await getReadContext();
	if (!ctx) throw new Error("Unauthorized");
	return ctx;
}

/**
 * Get all active accounts with their types
 */
export async function getAccounts(): Promise<AccountWithType[]> {
	return accountStore(await requireReadContext()).list();
}

/**
 * Get a single account by ID with its type
 */
export async function getAccountById(id: string): Promise<AccountWithType | null> {
	return accountStore(await requireReadContext()).get(id);
}

export const createAccount = defineAction("createAccount", [createAccountSchema], async (ctx, input) => {
	const account = await accounts.createAccount(ctx, input);
	revalidatePath("/accounts");
	return account;
});

/**
 * Update an existing account
 */
export const updateAccount = defineAction("updateAccount", [idSchema, updateAccountSchema], async (ctx, id, input) => {
	const account = await accounts.updateAccount(ctx, id, input);
	revalidatePath("/accounts");
	return account;
});

/**
 * Delete an account; its ledger history is kept.
 */
export const deleteAccount = defineAction("deleteAccount", [idSchema], async (ctx, id) => {
	await accounts.deleteAccount(ctx, id);
	revalidatePath("/accounts");
	revalidatePath("/allocations");
	revalidatePath("/dashboard");
});

/**
 * Reorder accounts
 */
export const reorderAccounts = defineAction("reorderAccounts", [displayOrderSchema], async (ctx, accountOrders) => {
	await accounts.reorderAccounts(ctx, accountOrders);
	revalidatePath("/accounts");
});

/**
 * Get transactions for an account
 */
export async function getAccountTransactions(accountId: string, limit: number = 50): Promise<AccountTransaction[]> {
	return accountStore(await requireReadContext()).listTransactions(accountId, limit);
}

/** Every ledger row dated on or after `since`, for working out a card's statement. */
export async function getAccountTransactionsSince(accountId: string, since: string): Promise<StatementLedgerRow[]> {
	return accountStore(await requireReadContext()).listTransactionsSince(accountId, since);
}

export interface AccountRecurringItem {
	id: string;
	name: string;
	amount: number;
	billing_period: string;
	next_due_date: string;
	category: string;
	/** "in" for a recurring transfer into this account; everything else takes money out. */
	direction: "in" | "out";
}

/** Active bills, subscriptions and transfers paid from this account, and transfers into it, soonest first. */
export async function getRecurringForAccount(accountId: string): Promise<AccountRecurringItem[]> {
	const ctx = await getReadContext();
	return ctx ? accountStore(ctx).listRecurring(accountId) : [];
}

/**
 * Get account history for charting
 */
export async function getAccountHistory(accountId: string, limit: number = 30): Promise<AccountHistory[]> {
	return accountStore(await requireReadContext()).listHistory(accountId, limit);
}

/**
 * Each account's recorded balances over the last `days` days, for the sparklines on the
 * Accounts page. One query for all accounts, grouped by account id.
 */
export async function getAccountSparklines(days: number = 30): Promise<Record<string, BalancePoint[]>> {
	const ctx = await getReadContext();
	return ctx ? accountStore(ctx).sparklines(days) : {};
}

export interface RecentActivityItem {
	id: string;
	accountId: string;
	accountName: string;
	type: "transaction" | "account_created";
	transactionType?: string;
	amount?: number;
	description?: string;
	timestamp: string;
}

/**
 * Get recent activity across all accounts (transactions + account creations)
 */
export async function getRecentActivity(limit: number = 10): Promise<RecentActivityItem[]> {
	const ctx = await getReadContext();
	return ctx ? accountStore(ctx).recentActivity(limit) : [];
}
