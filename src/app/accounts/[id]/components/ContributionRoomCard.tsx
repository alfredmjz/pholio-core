"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContributionCard } from "@/components/common/ContributionCard";
import { ContributionDetails } from "@/components/common/ContributionDetails";
import { getAccountContributionSummary } from "@/lib/actions/contribution-actions";
import {
	formatContributionAmount,
	getContributionPlanLabel,
	getRoomTerm,
	getRoomTitle,
	isRegisteredPlan,
} from "@/lib/contribution-plans";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import type { AccountWithType } from "../../types";
import type { AccountContribution } from "@/lib/types/contribution";
import { ContributedThisYearDialog } from "./ContributedThisYearDialog";

interface ContributionRoomCardProps {
	account: AccountWithType;
	/** Loaded by the server page, so router.refresh() after a save brings fresh figures. */
	contribution: AccountContribution | null;
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
}

/**
 * This month's deposits plus annual and lifetime contribution room for an investment
 * account (issue #121). The page refreshes it after every transaction or account save; a
 * client-side refetch there raced router.refresh(), which can cancel the request.
 */
export function ContributionRoomCard({ account, contribution: initialContribution, today }: ContributionRoomCardProps) {
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);
	// CRA tracks contribution room to the cent, so figures keep their cents.
	const formatCurrency = (amount: number) => formatContributionAmount(amount);
	// Still refetches on focus, so changes made in another tab show up.
	const { data: contribution, refresh } = useServerSyncedData<AccountContribution | null>(initialContribution, () =>
		getAccountContributionSummary(account.id)
	);

	const plan = account.track_contribution_room ? account.contribution_plan : null;
	const editablePlan = isRegisteredPlan(plan) ? plan : null;
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

			{editablePlan && contribution && (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="gap-2 self-start"
					onClick={() => setEditOpen(true)}
				>
					<Pencil className="h-3.5 w-3.5" />
					Edit contributed this year
				</Button>
			)}

			{!account.track_contribution_room && (
				<p className="type-caption text-muted-foreground">
					Turn on Track Contribution Room in Edit Details to see your annual and lifetime limits.
				</p>
			)}
			{editablePlan && (
				<ContributedThisYearDialog
					open={editOpen}
					onOpenChange={setEditOpen}
					plan={editablePlan}
					currentAmount={contribution?.pool.contributed_override ?? null}
					currentAsOf={contribution?.pool.contributed_as_of ?? null}
					today={today}
					onSaved={() => {
						void refresh();
						router.refresh();
					}}
				/>
			)}
		</ContributionCard>
	);
}
