"use client";

import { ContributionCard } from "@/components/common/ContributionCard";
import { ContributionDetails } from "@/components/common/ContributionDetails";
import { getAccountContributionSummary } from "@/lib/actions/contribution-actions";
import {
	formatContributionAmount,
	getContributionPlanLabel,
	getRoomTerm,
	getRoomTitle,
} from "@/lib/contribution-plans";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import type { AccountWithType } from "../../types";
import type { AccountContribution } from "@/lib/types/contribution";

interface ContributionRoomCardProps {
	account: AccountWithType;
	/** Loaded by the server page, so router.refresh() after a save brings fresh figures. */
	contribution: AccountContribution | null;
}

/**
 * This month's deposits plus annual and lifetime contribution room for an investment
 * account (issue #121). The page refreshes it after every transaction or account save; a
 * client-side refetch there raced router.refresh(), which can cancel the request.
 */
export function ContributionRoomCard({ account, contribution: initialContribution }: ContributionRoomCardProps) {
	// CRA tracks contribution room to the cent, so figures keep their cents.
	const formatCurrency = (amount: number) => formatContributionAmount(amount, account.currency || "CAD");
	// Still refetches on focus, so changes made in another tab show up.
	const { data: contribution } = useServerSyncedData<AccountContribution | null>(initialContribution, () =>
		getAccountContributionSummary(account.id)
	);

	const plan = account.track_contribution_room ? account.contribution_plan : null;
	const accountCount = contribution?.pool.account_ids.length ?? 1;
	const description = !plan
		? "Deposits and transfers into this account"
		: accountCount > 1
			? `Shared by your ${accountCount} ${getContributionPlanLabel(plan)} accounts`
			: `Deposits and transfers in, against your ${getRoomTerm(plan)}`;

	return (
		<ContributionCard
			title={plan ? getRoomTitle(plan) : "Contribution Room"}
			description={description}
			badge={account.contribution_plan ? getContributionPlanLabel(account.contribution_plan) : undefined}
			data-testid="contribution-room-card"
		>
			{contribution ? (
				<ContributionDetails
					summary={contribution.pool}
					share={contribution.share}
					formatCurrency={formatCurrency}
					showCraLink
				/>
			) : (
				<p className="type-body-sm text-muted-foreground">No contribution data yet.</p>
			)}

			{!account.track_contribution_room && (
				<p className="type-caption text-muted-foreground">
					Turn on Track Contribution Room in Edit Details to see your annual and lifetime limits.
				</p>
			)}
		</ContributionCard>
	);
}
