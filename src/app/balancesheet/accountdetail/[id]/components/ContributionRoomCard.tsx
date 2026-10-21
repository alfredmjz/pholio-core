"use client";

import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { AccountWithType, AccountTransaction } from "../../../types";
import type { AccountContribution } from "@/lib/types/contribution";

const NO_CONTRIBUTION: AccountContribution | null = null;

interface ContributionRoomCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
}

/**
 * This month's deposits plus annual and lifetime contribution room for an investment
 * account (issue #121). Refetches whenever the ledger or the account settings change.
 */
export function ContributionRoomCard({ account, transactions }: ContributionRoomCardProps) {
	// CRA tracks contribution room to the cent, so figures keep their cents.
	const formatCurrency = (amount: number) => formatContributionAmount(amount, account.currency || "CAD");
	const {
		data: contribution,
		refresh,
		isRefreshing,
	} = useServerSyncedData<AccountContribution | null>(
		NO_CONTRIBUTION,
		() => getAccountContributionSummary(account.id),
		{
			fetchOnMount: true,
		}
	);

	// Skip the first run: fetchOnMount already loads the initial summary.
	const isFirstRun = useRef(true);
	useEffect(() => {
		if (isFirstRun.current) {
			isFirstRun.current = false;
			return;
		}
		void refresh();
	}, [
		transactions,
		account.track_contribution_room,
		account.contribution_plan,
		account.contribution_room,
		account.contribution_room_as_of,
		account.annual_contribution_limit,
		// Saving the shared plan room from Edit Details only changes updated_at on the account.
		account.updated_at,
		refresh,
	]);

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
			) : isRefreshing ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</div>
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
