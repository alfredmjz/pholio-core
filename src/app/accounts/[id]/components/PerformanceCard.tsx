"use client";

import { SurfaceSection } from "@/components/layout/surface-section";
import { cn } from "@/lib/utils";
import type { AccountWithType, AccountTransaction } from "../../types";
import { AssetPerformance } from "./AssetPerformance";
import { CreditCardPerformance } from "./CreditCardPerformance";
import { LoanPerformance } from "./LoanPerformance";
import { BankPerformance } from "./BankPerformance";

export interface GlanceRow {
	label: string;
	value: string;
	tone?: "success" | "error" | "muted";
}

/** The figures that matter for this kind of account, as a short list of label and value. */
export function GlanceSection({ rows }: { rows: GlanceRow[] }) {
	return (
		<SurfaceSection id="glance-heading" title="At a glance">
			<dl className="flex flex-col divide-y divide-border/50">
				{rows.map((row) => (
					<div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
						<dt className="type-body-sm text-muted-foreground">{row.label}</dt>
						<dd
							className={cn(
								"type-value shrink-0 text-right",
								row.tone === "success"
									? "text-success"
									: row.tone === "error"
										? "text-error"
										: row.tone === "muted"
											? "text-muted-foreground"
											: "text-primary"
							)}
						>
							{row.value}
						</dd>
					</div>
				))}
			</dl>
		</SurfaceSection>
	);
}

interface PerformanceCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

/** Picks the figures by account type code; legacy rows without a code fall back to their category. */
export function PerformanceCard({ account, transactions, formatCurrency }: PerformanceCardProps) {
	const { code, category, class: accountClass } = account.account_type;
	const props = { account, transactions, formatCurrency };

	if (accountClass === "liability") {
		const isRevolving = code ? code === "credit_card" || code === "line_of_credit" : category === "credit";
		return isRevolving ? <CreditCardPerformance {...props} /> : <LoanPerformance {...props} />;
	}

	const isEveryday = code ? code === "chequing" || code === "other" : category === "banking";
	return isEveryday ? <BankPerformance {...props} /> : <AssetPerformance {...props} />;
}
