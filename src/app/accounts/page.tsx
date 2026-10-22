import { requireAuth } from "@/lib/auth";
import { getTimezone } from "@/app/settings/actions";
import { getOpenPromotions } from "@/lib/actions/promotion-actions";
import { formatDateString, getTodayDateString } from "@/lib/date-utils";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { getDemoNow } from "@/mock-data/demo-date";
import { sampleAccounts, getSampleRecentActivity } from "@/mock-data/accounts";
import { AccountsClient } from "./client";
import { getAccounts, getAccountSparklines, getRecentActivity } from "./actions";

export const metadata = {
	title: "Accounts | Pholio",
	description: "What you own and what you owe",
};

export default async function AccountsPage() {
	const sampleMode = await isSampleDataMode();
	if (!sampleMode) {
		await requireAuth();
	}

	const today = sampleMode ? formatDateString(getDemoNow()) : getTodayDateString((await getTimezone()) ?? undefined);
	const [accounts, activity, sparklines, promotions] = await Promise.all([
		sampleMode ? sampleAccounts : getAccounts(),
		sampleMode ? getSampleRecentActivity() : getRecentActivity(),
		getAccountSparklines(),
		getOpenPromotions(today),
	]);

	return (
		<AccountsClient
			initialAccounts={accounts}
			initialActivity={activity}
			sparklines={sparklines}
			promotions={promotions}
			today={today}
		/>
	);
}
