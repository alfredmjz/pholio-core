import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error("Missing Supabase credentials");
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
	console.log("Starting account balances audit...");

	const { data: accounts, error: accountsError } = await supabase
		.from("accounts")
		.select("*, account_type:account_types(*)")
		.eq("is_active", true);

	if (accountsError || !accounts) {
		console.error("Failed to fetch accounts:", accountsError);
		return;
	}

	for (const acc of accounts) {
		const isAsset = acc.account_type?.class === "asset";
		let calculatedBalance = acc.original_amount || 0; // Using this as a hypothetical starting point
		let calculatedChange = 0;

		const { data: transactions } = await supabase
			.from("account_transactions")
			.select("*")
			.eq("account_id", acc.id)
			.order("transaction_date", { ascending: true });

		if (!transactions) continue;

		for (const tx of transactions) {
			if (isAsset) {
				if (["deposit", "contribution", "refund", "interest"].includes(tx.transaction_type)) {
					calculatedChange += Math.abs(tx.amount);
				} else {
					calculatedChange -= Math.abs(tx.amount);
				}
			} else {
				if (["payment", "refund"].includes(tx.transaction_type)) {
					calculatedChange -= Math.abs(tx.amount);
				} else {
					// withdrawals, interest, fees, adjustments
					calculatedChange += Math.abs(tx.amount);
				}
			}
		}

		console.log(`Account [${acc.account_type?.class}]: ${acc.name}`);
		console.log(`  Current Balance in DB: ${acc.current_balance}`);
		console.log(`  Calculated Change from TXs: ${calculatedChange}`);
		console.log(`  Transactions Count: ${transactions.length}`);
		console.log("---");
	}
}

runAudit().catch(console.error);
