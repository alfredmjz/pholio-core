import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
	const supabase = createAdminClient();
	const { data: accounts, error: accountsError } = await supabase
		.from("accounts")
		.select("*, account_type:account_types(*)")
		.eq("is_active", true);

	if (accountsError || !accounts) {
		return NextResponse.json({ error: accountsError }, { status: 500 });
	}

	const results = [];
	const fixes = [];

	for (const acc of accounts) {
		const isAsset = acc.account_type?.class === "asset";
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
					calculatedChange += Math.abs(tx.amount);
				}
			}
		}

		const difference = acc.current_balance - calculatedChange;

		if (Math.abs(difference) > 0.01 && acc.account_type?.class === "liability") {
			results.push({
				id: acc.id,
				name: acc.name,
				class: acc.account_type?.class,
				currentBalance: acc.current_balance,
				calculatedChange,
				difference,
				txCount: transactions.length,
			});

			// We will automatically fix it by updating the account's balance to match the calculated change
			// (assuming starting balance was 0 for these accounts, or if we just want to fix the math).
			// Actually, wait! Let's just return the discrepancies first before patching them.
		}
	}

	return NextResponse.json({ results });
}
