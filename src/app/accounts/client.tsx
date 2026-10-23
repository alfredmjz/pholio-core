"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Button } from "@/components/ui/button";
import { SurfacePage } from "@/components/layout/surface-page";
import { SurfaceSection } from "@/components/layout/surface-section";
import { ShortcutHint } from "@/components/common/shortcut-hint";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { SHORTCUTS, ShortcutId } from "@/lib/keyboard-shortcuts";
import { isSampleDataActive } from "@/lib/demo-mode";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import type { HeadsUpPromotion } from "@/app/dashboard/heads-up";
import type { AccountWithType } from "./types";
import { type RecentActivityItem, reorderAccounts, getAccounts, getRecentActivity } from "./actions";
import { buildAccountAlerts, creditUtilization, sparklinePoints, type BalancePoint } from "./account-insights";
import { AddAccountDialog } from "./components/AddAccountDialog";
import { AccountTypeMigrationNotice } from "./components/AccountTypeMigrationNotice";
import { RecentActivity } from "./components/RecentActivity";
import { AccountAlerts } from "./components/account-alerts";
import { ACCOUNT_GRID, AccountRow } from "./components/account-row";

interface AccountsClientProps {
	initialAccounts: AccountWithType[];
	initialActivity: RecentActivityItem[];
	sparklines: Record<string, BalancePoint[]>;
	promotions: HeadsUpPromotion[];
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
}

function AccountGroup({
	id,
	title,
	accounts,
	sparklines,
	today,
	onReorder,
	emptyText,
}: {
	id: string;
	title: string;
	accounts: AccountWithType[];
	sparklines: Record<string, BalancePoint[]>;
	today: string;
	onReorder: (ordered: AccountWithType[]) => void;
	emptyText: string;
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
	const total = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = accounts.findIndex((a) => a.id === active.id);
		const to = accounts.findIndex((a) => a.id === over.id);
		if (from !== -1 && to !== -1) onReorder(arrayMove(accounts, from, to));
	};

	return (
		<SurfaceSection
			id={id}
			title={title}
			className="rows-container"
			note={accounts.length > 0 ? `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}` : undefined}
			headerActions={
				accounts.length > 0 ? <span className="type-stat text-primary">{formatCurrency(total)}</span> : undefined
			}
		>
			{accounts.length === 0 ? (
				<p className="type-body-sm py-2 text-muted-foreground">{emptyText}</p>
			) : (
				<>
					<div
						className={cn(
							ACCOUNT_GRID,
							"type-body-xs hidden border-b border-border/70 pb-2 pl-7 pr-3 text-muted-foreground row-wide:grid"
						)}
						aria-hidden
					>
						<span>Account</span>
						<span>30 days</span>
						<span className="pl-8">Progress</span>
						<span className="text-right">Balance</span>
					</div>
					<DndContext
						id={`${id}-list`}
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
						modifiers={[restrictToVerticalAxis, restrictToParentElement]}
					>
						<SortableContext items={accounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
							<ul className="mt-1 divide-y divide-border/50" aria-label={title}>
								{accounts.map((account) => (
									<AccountRow
										key={account.id}
										account={account}
										history={sparklinePoints(sparklines[account.id] ?? [], Number(account.current_balance), today)}
										sortable={accounts.length > 1}
									/>
								))}
							</ul>
						</SortableContext>
					</DndContext>
				</>
			)}
		</SurfaceSection>
	);
}

export function AccountsClient({
	initialAccounts,
	initialActivity,
	sparklines,
	promotions,
	today,
}: AccountsClientProps) {
	const router = useRouter();
	const { data: serverAccounts, setData: setAccounts } = useServerSyncedData<AccountWithType[]>(initialAccounts, () =>
		getAccounts()
	);
	const { data: activity } = useServerSyncedData<RecentActivityItem[]>(initialActivity, () => getRecentActivity());

	const [isDemo, setIsDemo] = useState(false);
	const demoAccounts = useDemoStore((state) => state.accounts);
	const accounts = isDemo ? demoAccounts : serverAccounts;
	useEffect(() => {
		setIsDemo(isSampleDataActive());
	}, []);

	const [addDialogOpen, setAddDialogOpen] = useState(false);
	useKeyboardShortcut(SHORTCUTS[ShortcutId.AddAccount].keys, () => setAddDialogOpen(true));

	const owned = accounts.filter((a) => a.account_type?.class === "asset");
	const owed = accounts.filter((a) => a.account_type?.class === "liability");
	const totalOwned = owned.reduce((sum, a) => sum + Number(a.current_balance), 0);
	const totalOwed = owed.reduce((sum, a) => sum + Number(a.current_balance), 0);
	const credit = creditUtilization(accounts);
	const alerts = buildAccountAlerts({ accounts, today, promotions });

	const handleAccountSuccess = (newAccount: AccountWithType) => {
		// Demo mode: the dialog already added the account to the in-memory store.
		if (isDemo) return;
		setAccounts((prev) => [...prev, newAccount]);
		router.refresh();
	};

	// Saves one group's new order; owned accounts stay ahead of owed ones in the stored order.
	const handleReorder = (cls: "asset" | "liability", ordered: AccountWithType[]) => {
		const next = cls === "asset" ? [...ordered, ...owed] : [...owned, ...ordered];
		setAccounts(next);
		reorderAccounts(next.map((account, index) => ({ id: account.id, display_order: index }))).then((success) => {
			if (!success) toast.error("Couldn't save the new order", { description: "Try dragging it again." });
		});
	};

	return (
		<SurfacePage>
			<AccountTypeMigrationNotice />

			<header className="flex flex-wrap items-end justify-between gap-4">
				<div className="min-w-0">
					<h1 className="type-h2 text-primary">Accounts</h1>
					<p className="type-body mt-1 text-muted-foreground">
						{accounts.length} {accounts.length === 1 ? "account" : "accounts"} in one place
					</p>
				</div>
				<Button onClick={() => setAddDialogOpen(true)} className="h-10 gap-2 rounded-full pl-3.5 pr-4">
					<Plus className="h-4 w-4" aria-hidden />
					Add account
					<ShortcutHint
						keys={SHORTCUTS[ShortcutId.AddAccount].keys}
						keyClassName="border-current bg-transparent text-current"
					/>
				</Button>
			</header>

			<dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
				<div>
					<dt className="type-body-xs text-muted-foreground">You own</dt>
					<dd className="type-stat mt-1 text-primary">{formatCurrency(totalOwned)}</dd>
				</div>
				<div>
					<dt className="type-body-xs text-muted-foreground">You owe</dt>
					<dd className="type-stat mt-1 text-primary">{formatCurrency(totalOwed)}</dd>
				</div>
				<div>
					<dt className="type-body-xs text-muted-foreground">Net worth</dt>
					<dd className={cn("type-stat mt-1", totalOwned - totalOwed < 0 ? "text-error" : "text-primary")}>
						{formatCurrency(totalOwned - totalOwed)}
					</dd>
				</div>
				<div>
					<dt
						className="type-body-xs text-muted-foreground"
						title="Card balances against their combined limits, a big part of a credit score"
					>
						Credit used
					</dt>
					{credit.percent === null ? (
						<dd className="type-body-sm mt-1.5 text-muted-foreground">Add a card limit to see this</dd>
					) : (
						<dd className="mt-1">
							<span className={cn("type-stat", credit.percent >= 30 ? "text-warning" : "text-primary")}>
								{Math.round(credit.percent)}%
							</span>
							<span className="type-body-xs ml-1.5 text-muted-foreground">of {formatCurrency(credit.limit)}</span>
						</dd>
					)}
				</div>
			</dl>

			<AccountAlerts alerts={alerts} />

			<div className="grid grid-cols-1 gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
				<div className="flex min-w-0 flex-col gap-5 lg:gap-6">
					<AccountGroup
						id="owned-heading"
						title="You own"
						accounts={owned}
						sparklines={sparklines}
						today={today}
						onReorder={(ordered) => handleReorder("asset", ordered)}
						emptyText="Add chequing, savings or investment accounts to track what you own."
					/>
					<AccountGroup
						id="owed-heading"
						title="You owe"
						accounts={owed}
						sparklines={sparklines}
						today={today}
						onReorder={(ordered) => handleReorder("liability", ordered)}
						emptyText="Add credit cards, lines of credit or loans to track what you owe."
					/>
				</div>
				<div className="min-w-0">
					<RecentActivity activity={activity} />
				</div>
			</div>

			<AddAccountDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onSuccess={handleAccountSuccess} />
		</SurfacePage>
	);
}
