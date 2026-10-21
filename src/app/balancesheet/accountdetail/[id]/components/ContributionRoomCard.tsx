"use client";

import { useEffect, useRef } from "react";
import { PiggyBank } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ContributionDetails } from "@/components/common/ContributionDetails";
import { getAccountContributionSummary } from "@/lib/actions/contribution-actions";
import { getContributionPlanLabel } from "@/lib/contribution-plans";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import type { AccountWithType, AccountTransaction } from "../../../types";
import type { AccountContribution } from "@/lib/types/contribution";

const NO_CONTRIBUTION: AccountContribution | null = null;

interface ContributionRoomCardProps {
	account: AccountWithType;
	transactions: AccountTransaction[];
	formatCurrency: (amount: number) => string;
}

/**
 * This month's deposits plus annual and lifetime contribution room for an investment
 * account (issue #121). Refetches whenever the ledger or the account settings change.
 */
export function ContributionRoomCard({ account, transactions, formatCurrency }: ContributionRoomCardProps) {
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

	return (
		<Card className="p-5" data-testid="contribution-room-card">
			<div className="flex flex-col gap-4">
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2.5">
						<div className="rounded-lg bg-success-muted p-2 text-success">
							<PiggyBank className="h-4 w-4" />
						</div>
						<div className="min-w-0">
							<h3 className="type-label">Contribution Room</h3>
							<p className="type-caption text-muted-foreground">
								{contribution && contribution.pool.account_ids.length > 1
									? `Shared by your ${contribution.pool.account_ids.length} ${getContributionPlanLabel(account.contribution_plan)} accounts`
									: "Deposits and transfers in, against CRA limits"}
							</p>
						</div>
					</div>
					{account.contribution_plan && (
						<Badge variant="secondary" className="shrink-0">
							{getContributionPlanLabel(account.contribution_plan)}
						</Badge>
					)}
				</div>

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
			</div>
		</Card>
	);
}
