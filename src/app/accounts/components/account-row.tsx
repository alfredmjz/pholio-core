"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Building2,
	CreditCard,
	GripVertical,
	HandCoins,
	Home,
	Landmark,
	PiggyBank,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressLine } from "@/components/ui/progress-line";
import { formatCurrency } from "@/app/dashboard/utils";
import type { AccountTypeCode, AccountWithType } from "../types";
import { accountProgress, type BalancePoint } from "../account-insights";
import { AccountSparkline } from "./account-sparkline";

/** Columns shared by the group header and every account row, once the list is wide enough (see `row-wide`). */
export const ACCOUNT_GRID =
	"row-wide:grid row-wide:grid-cols-[minmax(10rem,1.6fr)_6rem_minmax(8.5rem,1fr)_7rem] row-wide:items-center row-wide:gap-5";

export const TYPE_ICON: Record<AccountTypeCode, typeof Wallet> = {
	chequing: Landmark,
	savings: PiggyBank,
	investment: TrendingUp,
	credit_card: CreditCard,
	line_of_credit: CreditCard,
	mortgage: Home,
	loan: HandCoins,
	other: Building2,
};

interface AccountRowProps {
	account: AccountWithType;
	history: BalancePoint[];
	sortable?: boolean;
}

/** One account: what it is, where its balance has been heading, its progress and its balance. */
export function AccountRow({ account, history, sortable = true }: AccountRowProps) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: account.id,
		disabled: !sortable,
	});

	const isLiability = account.account_type?.class === "liability";
	const Icon = TYPE_ICON[(account.account_type?.code as AccountTypeCode) ?? "other"] ?? Wallet;
	const progress = accountProgress(account);
	const balance = Number(account.current_balance);

	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn("group relative rounded-xl", isDragging && "z-10 bg-card shadow-raised ring-1 ring-border")}
		>
			<div className="flex items-center">
				<button
					type="button"
					ref={setActivatorNodeRef}
					{...attributes}
					{...listeners}
					disabled={!sortable}
					className={cn(
						"-ml-1 flex h-8 w-5 shrink-0 touch-none items-center justify-center rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						sortable
							? "cursor-grab opacity-50 hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing md:opacity-0 md:group-hover:opacity-60"
							: "invisible"
					)}
					aria-label={`Reorder ${account.name}`}
				>
					<GripVertical className="h-4 w-4" />
				</button>

				<Link
					href={`/accounts/${account.id}`}
					className={cn(ACCOUNT_GRID, "row-interactive block min-w-0 flex-1 rounded-xl px-2 py-3 row-wide:px-3")}
				>
					<div className="flex min-w-0 items-center gap-3">
						<span
							className={cn(
								"flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
								isLiability ? "bg-error-muted text-error" : "bg-card-muted text-primary"
							)}
							aria-hidden
						>
							<Icon className="h-4 w-4" />
						</span>
						<span className="min-w-0 flex-1">
							<span className="type-body-sm block truncate font-medium text-primary">{account.name}</span>
							<span className="type-body-xs block truncate text-muted-foreground">
								{[account.institution, account.account_type?.name].filter(Boolean).join(", ")}
							</span>
						</span>
						<span className="type-value shrink-0 text-primary row-wide:hidden">
							{formatCurrency(balance, { showCents: true })}
						</span>
					</div>

					<AccountSparkline
						points={history}
						tone={isLiability ? "liability" : "asset"}
						className="hidden row-wide:block"
					/>

					<div className="mt-2 pl-12 row-wide:mt-0 row-wide:pl-8">
						{progress ? (
							<>
								<ProgressLine
									value={progress.percent}
									tone={progress.tone === "caution" ? "bg-warning" : isLiability ? "bg-error/70" : "bg-accent"}
									className="max-w-[160px]"
								/>
								<span
									className={cn(
										"type-body-xs mt-1.5 block",
										progress.tone === "caution" ? "text-warning" : "text-muted-foreground"
									)}
								>
									{progress.label}
								</span>
							</>
						) : (
							<span className="type-body-xs hidden text-muted-foreground row-wide:block">No goal or limit set</span>
						)}
					</div>

					<span className="type-value hidden text-right text-primary row-wide:block">
						{formatCurrency(balance, { showCents: true })}
					</span>
				</Link>
			</div>
		</li>
	);
}
