import { createAdminClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
import { isCardInterestWaived, lastEndedCycle } from "@/lib/credit-card-statement";
import { getTodayDateString } from "@/lib/date-utils";
import { monthlyInterest } from "@/lib/interest";
import { overdraftInterest } from "@/lib/overdraft";

/** Postgres error code for the one-interest-row-per-month index (migration 014). */
const UNIQUE_VIOLATION = "23505";

/**
 * Process monthly interest for all accounts (Called by Cron Job).
 *
 * Uses the admin client, which bypasses RLS, so it must stay out of "use server"
 * files: everything exported there becomes a server action a browser can call.
 * Only the authorized cron route may import it.
 */
export async function processGlobalMonthlyInterest(): Promise<{ success: boolean; processed: number; error?: string }> {
	try {
		const supabase = createAdminClient();

		const { data: accounts, error } = await supabase
			.from("accounts")
			.select(
				"id, current_balance, interest_rate, interest_type, user_id, payment_due_date, statement_day, account_types(code, category)"
			)
			.eq("is_active", true)
			.not("interest_rate", "is", null)
			.gt("interest_rate", 0)
			// A rate saved without an interest type (the Edit dialog never set one) still earns interest.
			.or("interest_type.is.null,interest_type.in.(simple,compound)");

		if (error) {
			Logger.error("Error fetching accounts for interest", { error });
			return { success: false, processed: 0, error: "Failed to fetch accounts" };
		}

		// One interest row per account per month, so a retried or repeated run skips accounts already paid.
		const period = `${getTodayDateString().slice(0, 7)}-01`;
		const posted = await accountsWithInterest(supabase, period);
		let processedCount = 0;

		for (const account of accounts ?? []) {
			if (posted.has(account.id)) continue;
			const type = Array.isArray(account.account_types) ? account.account_types[0] : account.account_types;
			// An investment's balance is the amount deposited; interest would make it a market value.
			if (isInvestmentAccount({ account_type: type })) continue;
			try {
				// Zero for a balance at or below zero, so an overdrawn account never earns deposit interest.
				const interestAmount = monthlyInterest(account.current_balance, account.interest_rate);
				if (interestAmount <= 0) continue;
				if (await isStatementPaidInFull(supabase, account)) continue;

				const { error: txError } = await supabase.from("account_transactions").insert({
					account_id: account.id,
					user_id: account.user_id,
					amount: interestAmount,
					transaction_type: "interest",
					description: `Monthly ${account.interest_type ?? "compound"} interest`,
					transaction_date: new Date().toISOString().split("T")[0],
					interest_period: period,
				});

				// Another run posted this month between the check above and this insert.
				if (txError?.code === UNIQUE_VIOLATION) continue;
				if (txError) throw txError;

				const { error: updateError } = await supabase
					.from("accounts")
					.update({ current_balance: Math.round((Number(account.current_balance) + interestAmount) * 100) / 100 })
					.eq("id", account.id);

				if (updateError) throw updateError;

				processedCount++;
			} catch (err) {
				Logger.error(`Failed to process interest for account ${account.id}`, { error: err });
			}
		}

		processedCount += await chargeOverdraftInterest(supabase, period, posted);

		return { success: true, processed: processedCount };
	} catch (error) {
		Logger.error("Failed global interest processing", { error });
		return { success: false, processed: 0, error: "Internal processing error" };
	}
}

/** A card whose last statement was paid in full by its due date owes no interest this month. */
async function isStatementPaidInFull(
	supabase: ReturnType<typeof createAdminClient>,
	account: {
		id: string;
		current_balance: number;
		payment_due_date: number | null;
		statement_day: number | null;
		account_types: { code: string | null } | { code: string | null }[] | null;
	}
): Promise<boolean> {
	const type = Array.isArray(account.account_types) ? account.account_types[0] : account.account_types;
	if (type?.code !== "credit_card") return false;
	const runDate = new Date().toISOString().split("T")[0];
	const settings = { dueDay: account.payment_due_date, statementDay: account.statement_day };
	const cycle = lastEndedCycle(settings, runDate);
	if (!cycle) return false;

	const { data: rows, error } = await supabase
		.from("account_transactions")
		.select("amount, transaction_date")
		.eq("account_id", account.id)
		.gt("transaction_date", cycle.closeDate);
	if (error) throw error;

	return isCardInterestWaived(settings, Number(account.current_balance), rows ?? [], runDate);
}

/** One month of overdraft interest on every protected account below zero. Returns how many were charged. */
async function chargeOverdraftInterest(
	supabase: ReturnType<typeof createAdminClient>,
	period: string,
	posted: Set<string>
): Promise<number> {
	const { data: accounts, error } = await supabase
		.from("accounts")
		.select("id, user_id, current_balance, overdraft_interest_rate")
		.eq("is_active", true)
		.eq("overdraft_protection", true)
		.gt("overdraft_interest_rate", 0)
		.lt("current_balance", 0);

	if (error) {
		Logger.error("Error fetching overdrawn accounts for interest", { error });
		return 0;
	}

	let charged = 0;
	for (const account of accounts ?? []) {
		if (posted.has(account.id)) continue;
		const amount = overdraftInterest(Number(account.current_balance), Number(account.overdraft_interest_rate));
		if (amount === 0) continue;
		try {
			const { error: txError } = await supabase.from("account_transactions").insert({
				account_id: account.id,
				user_id: account.user_id,
				amount,
				transaction_type: "interest",
				description: "Overdraft interest",
				transaction_date: getTodayDateString(),
				interest_period: period,
			});
			if (txError?.code === UNIQUE_VIOLATION) continue;
			if (txError) throw txError;

			const { error: updateError } = await supabase
				.from("accounts")
				.update({ current_balance: Math.round((Number(account.current_balance) + amount) * 100) / 100 })
				.eq("id", account.id);
			if (updateError) throw updateError;

			charged++;
		} catch (err) {
			Logger.error(`Failed to charge overdraft interest for account ${account.id}`, { error: err });
		}
	}
	return charged;
}

/** Accounts that already have an interest row for the month starting on `period`. */
async function accountsWithInterest(supabase: ReturnType<typeof createAdminClient>, period: string): Promise<Set<string>> {
	const { data, error } = await supabase.from("account_transactions").select("account_id").eq("interest_period", period);
	if (error) throw error;
	return new Set((data ?? []).map((row) => row.account_id as string));
}
