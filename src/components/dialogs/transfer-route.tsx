"use client";

import { ArrowDown, ArrowRight, ArrowUpDown, Wallet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { sortAccounts } from "@/lib/account-utils";
import type { AccountTypeCode, AccountWithType } from "@/app/accounts/types";
import { TYPE_ICON } from "@/app/accounts/components/account-row";

const NONE = "none";

function AccountIcon({ account, className }: { account?: AccountWithType; className?: string }) {
	const Icon = account ? (TYPE_ICON[(account.account_type?.code as AccountTypeCode) ?? "other"] ?? Wallet) : Wallet;
	const isLiability = account?.account_type?.class === "liability";
	return (
		<span
			className={cn(
				"flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
				!account
					? "bg-primary/[0.05] text-muted-foreground"
					: isLiability
						? "bg-error-muted text-error"
						: "bg-card-muted text-primary",
				className
			)}
			aria-hidden
		>
			<Icon className="h-4 w-4" />
		</span>
	);
}

/** "$1,200.00 available" for what you own, "$450.00 owing" for what you owe. */
function balanceLabel(account: AccountWithType) {
	const balance = formatCurrency(Number(account.current_balance), { showCents: true });
	return account.account_type?.class === "liability" ? `${balance} owing` : `${balance} available`;
}

function AccountSlot({
	label,
	value,
	onChange,
	accounts,
	excludeId,
	error,
}: {
	label: "From" | "To";
	value: string;
	onChange: (id: string) => void;
	accounts: AccountWithType[];
	excludeId: string;
	error?: string;
}) {
	const selected = accounts.find((account) => account.id === value);

	return (
		<div className="space-y-1.5">
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger
					aria-label={`${label} account`}
					className={cn("h-auto rounded-2xl py-3 pl-3 pr-4 text-left", error && "border-error")}
				>
					{/* !flex: the trigger clamps its direct span children to one line, which would stack this row. */}
					<span className="!flex min-w-0 flex-1 items-center gap-3">
						<AccountIcon account={selected} />
						<span className="min-w-0 flex-1">
							<span className="type-body-xs block text-muted-foreground">{label}</span>
							{selected ? (
								<>
									<span className="type-body-sm block truncate font-medium text-primary">{selected.name}</span>
									<span className="type-body-xs block truncate text-muted-foreground">
										{[selected.institution, balanceLabel(selected)].filter(Boolean).join(", ")}
									</span>
								</>
							) : (
								// Same three lines as a picked account, so choosing one never changes the height.
								<>
									<span className="type-body-sm block text-muted-foreground">Choose an account</span>
									{/* A missing pick says so on this line, so the error never adds height either. */}
									<span className={cn("type-body-xs block", error ? "text-error" : "text-muted-foreground/70")}>
										{error ?? (label === "From" ? "Where the money comes from" : "Where the money lands")}
									</span>
								</>
							)}
						</span>
						{/* Keeps the chosen value announced to screen readers. */}
						<span className="sr-only">
							<SelectValue />
						</span>
					</span>
				</SelectTrigger>
				<SelectContent>
					{/* The account picked in the other slot stays in the list but hidden, so a swap can
					    move it here without Radix dropping the value. */}
					{sortAccounts(accounts).map((account) => (
						<SelectItem
							key={account.id}
							value={account.id}
							disabled={account.id === excludeId}
							className={cn(account.id === excludeId && "hidden")}
						>
							<span className="flex min-w-0 items-center gap-3">
								<AccountIcon account={account} className="h-7 w-7 [&>svg]:h-3.5 [&>svg]:w-3.5" />
								<span className="min-w-0">
									<span className="block truncate">{account.name}</span>
									<span className="type-body-xs block truncate text-muted-foreground">
										{[account.institution, balanceLabel(account)].filter(Boolean).join(", ")}
									</span>
								</span>
							</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

interface TransferRouteProps {
	accounts: AccountWithType[];
	fromAccountId: string;
	toAccountId: string;
	onFromChange: (id: string) => void;
	onToChange: (id: string) => void;
	onSwap: () => void;
	errors: { fromAccountId?: string; toAccountId?: string };
}

/**
 * Step one of a transfer: where the money leaves and where it lands, one above the other
 * with a swap between them. Nothing appears or disappears as accounts are picked, so the
 * dialog keeps its height.
 */
export function TransferRoute({
	accounts,
	fromAccountId,
	toAccountId,
	onFromChange,
	onToChange,
	onSwap,
	errors,
}: TransferRouteProps) {
	const canSwap = fromAccountId !== NONE || toAccountId !== NONE;

	return (
		<div className="flex flex-col">
			<AccountSlot
				label="From"
				value={fromAccountId}
				onChange={onFromChange}
				accounts={accounts}
				excludeId={toAccountId}
				error={errors.fromAccountId}
			/>
			<div className="relative z-10 -my-2 flex justify-center">
				<button
					type="button"
					onClick={onSwap}
					disabled={!canSwap}
					data-dialog-ignore-enter=""
					aria-label="Swap from and to"
					title="Swap"
					className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card transition-colors hover:border-border-strong hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
				>
					{canSwap ? <ArrowUpDown className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
				</button>
			</div>
			<AccountSlot
				label="To"
				value={toAccountId}
				onChange={onToChange}
				accounts={accounts}
				excludeId={fromAccountId}
				error={errors.toAccountId}
			/>
		</div>
	);
}

/** Step two's reminder of the route, with a way back to change it. */
export function TransferRouteSummary({
	from,
	to,
	onChange,
}: {
	from?: AccountWithType;
	to?: AccountWithType;
	onChange: () => void;
}) {
	return (
		<div className="flex items-center gap-3 rounded-2xl bg-primary/[0.04] px-3 py-2.5">
			<AccountIcon account={from} className="h-8 w-8" />
			<span className="min-w-0 flex-1">
				<span className="type-body-sm flex min-w-0 items-center gap-1.5 font-medium text-primary">
					<span className="truncate">{from?.name}</span>
					<ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="to" />
					<span className="truncate">{to?.name}</span>
				</span>
				{from && <span className="type-body-xs block truncate text-muted-foreground">{balanceLabel(from)}</span>}
			</span>
			<button
				type="button"
				onClick={onChange}
				data-dialog-ignore-enter=""
				className="type-body-sm shrink-0 rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-primary/[0.05] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				Change
			</button>
		</div>
	);
}
