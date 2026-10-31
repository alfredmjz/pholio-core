import Link from "next/link";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressLine } from "@/components/ui/progress-line";
import { formatFullDate } from "@/lib/date-utils";
import {
	CRA_LOGIN_URL,
	capitalizeRoomTerm,
	getContributionNotices,
	getContributionPlanLabel,
	type ContributionNotice,
} from "@/lib/contribution-plans";
import type { ContributionAccountShare, ContributionSummary } from "@/lib/types/contribution";

const NOTICE_STYLES: Record<ContributionNotice["level"], { className: string; Icon: typeof AlertCircle }> = {
	exceeded: { className: "text-error", Icon: AlertCircle },
	warning: { className: "text-warning", Icon: AlertTriangle },
	info: { className: "text-info", Icon: Info },
};

export function ContributionNotices({ notices, className }: { notices: ContributionNotice[]; className?: string }) {
	if (notices.length === 0) return null;
	return (
		<ul className={cn("flex flex-col gap-1.5", className)}>
			{notices.map((notice) => {
				const { className: tone, Icon } = NOTICE_STYLES[notice.level];
				return (
					<li key={notice.message} className={cn("flex items-start gap-1.5 type-body-xs", tone)}>
						<Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
						<span>{notice.message}</span>
					</li>
				);
			})}
		</ul>
	);
}

function ProgressBar({ used, total, label }: { used: number; total: number; label: string }) {
	const percent = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : used > 0 ? 100 : 0;
	const tone = used > total ? "bg-error" : percent >= 90 ? "bg-warning" : "bg-success";
	return <ProgressLine value={percent} tone={tone} label={label} />;
}

interface ContributionDetailsProps {
	summary: ContributionSummary;
	/** This account's part of a shared plan pool, shown next to the plan-wide figures. */
	share?: ContributionAccountShare | null;
	formatCurrency: (amount: number) => string;
	/** Label for the month figure, e.g. "This month" or "October". */
	monthLabel?: string;
	/** Label for the room line; defaults to CRA's term, e.g. "RRSP deduction limit left". */
	roomLabel?: string;
	showCraLink?: boolean;
}

/**
 * Monthly deposits plus annual and lifetime contribution progress for one plan pool (every
 * account of a registered plan) or a single investment account. Every figure comes from
 * get_contribution_summaries(); nothing is recalculated here.
 */
export function ContributionDetails({
	summary,
	share,
	formatCurrency,
	monthLabel = "This month",
	roomLabel,
	showCraLink = false,
}: ContributionDetailsProps) {
	const planLabel = getContributionPlanLabel(summary.contribution_plan);
	const roomLineLabel = roomLabel ?? `${capitalizeRoomTerm(summary.contribution_plan)} left`;
	const notices = getContributionNotices(summary, formatCurrency);
	const availableRoom = (summary.room_entered ?? 0) + (summary.room_added ?? 0);
	const isShared = summary.account_ids.length > 1;

	return (
		<div className="flex flex-col gap-3">
			{isShared && share && (
				<div className="flex items-baseline justify-between gap-2">
					<span className="type-body-sm text-muted-foreground">{monthLabel}, this account</span>
					<span className="type-value text-success">{formatCurrency(share.month_contributions)}</span>
				</div>
			)}
			<div className="flex items-baseline justify-between gap-2">
				<span className="type-body-sm text-muted-foreground">
					{isShared
						? `${monthLabel}, all ${summary.account_ids.length} ${planLabel} accounts`
						: `${monthLabel} deposited`}
				</span>
				<span className={cn("type-value", !isShared && "text-success")}>
					{formatCurrency(summary.month_contributions)}
				</span>
			</div>
			{summary.month_withdrawals > 0 && (
				<div className="flex items-baseline justify-between gap-2">
					<span className="type-body-sm text-muted-foreground">{monthLabel} withdrawn</span>
					<span className="type-value text-error">{formatCurrency(summary.month_withdrawals)}</span>
				</div>
			)}

			{!summary.tracks_room ? (
				<div className="flex items-baseline justify-between gap-2">
					<span className="type-body-sm text-muted-foreground">Deposited this year</span>
					<span className="type-value">{formatCurrency(summary.year_contributions)}</span>
				</div>
			) : (
				<>
					{/* Annual contribution */}
					<div className="flex flex-col gap-1.5 border-t border-border pt-3">
						<div className="flex items-baseline justify-between gap-2">
							<span className="type-label">Annual contribution</span>
							<span className="type-body-sm">
								{formatCurrency(summary.year_contributions)}
								{summary.annual_limit !== null && (
									<span className="text-muted-foreground"> of {formatCurrency(summary.annual_limit)}</span>
								)}
							</span>
						</div>
						{summary.annual_limit !== null ? (
							<>
								<ProgressBar
									used={summary.year_contributions}
									total={summary.annual_limit}
									label={`${planLabel} annual contribution`}
								/>
								<span className="type-caption text-muted-foreground">
									{summary.annual_limit_source === "cra" ? "CRA limit for this year" : "Your limit for this year"}
									{summary.annual_remaining !== null && summary.annual_remaining >= 0
										? ` · ${formatCurrency(summary.annual_remaining)} left`
										: ""}
								</span>
							</>
						) : (
							<span className="type-caption text-muted-foreground">No annual limit for this plan</span>
						)}
					</div>

					{/* Room left, across every account of the plan */}
					<div className="flex flex-col gap-1.5">
						<div className="flex items-baseline justify-between gap-2">
							<span className="type-label">{roomLineLabel}</span>
							<span
								className={cn(
									"type-body-sm",
									summary.room_remaining !== null && summary.room_remaining < 0 && "text-error"
								)}
							>
								{summary.room_remaining !== null ? formatCurrency(summary.room_remaining) : "Not set"}
							</span>
						</div>
						{summary.room_remaining !== null && (
							<>
								<ProgressBar used={summary.room_used ?? 0} total={availableRoom} label={roomLineLabel} />
								<span className="type-caption text-muted-foreground">
									{formatCurrency(summary.room_used ?? 0)} used of {formatCurrency(availableRoom)}
									{summary.room_as_of ? ` since ${formatFullDate(summary.room_as_of)}` : ""}
									{summary.lifetime_limit !== null
										? ` · ${planLabel} lifetime cap ${formatCurrency(summary.lifetime_limit)}`
										: ""}
								</span>
							</>
						)}
					</div>

					{((summary.excess_amount ?? 0) > 0 || (summary.tax_this_year ?? 0) > 0) && (
						<div className="flex flex-col gap-1 rounded-md bg-error-muted px-3 py-2" data-testid="contribution-tax">
							<div className="flex items-baseline justify-between gap-2">
								<span className="type-label text-error">Estimated CRA tax this year</span>
								<span className="type-body-sm tabular-nums text-error">
									{formatCurrency(summary.tax_this_year ?? 0)}
								</span>
							</div>
							<span className="type-caption text-muted-foreground">
								1% a month on the excess
								{(summary.tax_this_month ?? 0) > 0 ? ` · ${formatCurrency(summary.tax_this_month!)} this month` : ""}
								{(summary.excess_amount ?? 0) > 0
									? ` · stops once you withdraw ${formatCurrency(summary.excess_amount!)}`
									: ""}
							</span>
						</div>
					)}

					<ContributionNotices notices={notices} />

					{showCraLink && (
						<Link
							href={CRA_LOGIN_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="type-caption text-muted-foreground underline underline-offset-2 hover:text-primary"
						>
							Check your official room in CRA
						</Link>
					)}
				</>
			)}
		</div>
	);
}
