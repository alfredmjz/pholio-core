import { createAdminClient } from "@/lib/supabase/server";
import { Logger } from "@/lib/logger";

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
			.select("id, current_balance, interest_rate, interest_type, user_id")
			.eq("is_active", true)
			.not("interest_rate", "is", null)
			.gt("interest_rate", 0)
			.in("interest_type", ["simple", "compound"]);

		if (error) {
			Logger.error("Error fetching accounts for interest", { error });
			return { success: false, processed: 0, error: "Failed to fetch accounts" };
		}

		if (!accounts || accounts.length === 0) {
			return { success: true, processed: 0 };
		}

		let processedCount = 0;

		for (const account of accounts) {
			try {
				const interestAmount = account.current_balance * (account.interest_rate / 12);
				if (interestAmount <= 0) continue;

				const { error: txError } = await supabase.from("account_transactions").insert({
					account_id: account.id,
					user_id: account.user_id,
					amount: interestAmount,
					transaction_type: "interest",
					description: `Monthly ${account.interest_type} interest`,
					transaction_date: new Date().toISOString().split("T")[0],
				});

				if (txError) throw txError;

				const { error: updateError } = await supabase
					.from("accounts")
					.update({ current_balance: account.current_balance + interestAmount })
					.eq("id", account.id);

				if (updateError) throw updateError;

				processedCount++;
			} catch (err) {
				Logger.error(`Failed to process interest for account ${account.id}`, { error: err });
			}
		}

		return { success: true, processed: processedCount };
	} catch (error) {
		Logger.error("Failed global interest processing", { error });
		return { success: false, processed: 0, error: "Internal processing error" };
	}
}
