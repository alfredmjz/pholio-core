"use client";

import "@/styles/dashboard.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UnifiedTransactionDialog } from "@/components/dialogs/UnifiedTransactionDialog";
import { SurfacePage } from "@/components/layout/surface-page";
import type { DashboardData } from "./types";
import { getDashboardData } from "./actions";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import { isSampleDataActive } from "@/lib/demo-mode";
import { useDemoStore } from "@/lib/demo-store";
import { DashboardHeader } from "./components/dashboard-header";
import { NetWorthHero } from "./components/net-worth-hero";
import { HeadsUpList } from "./components/heads-up-list";
import { MonthPaceCard } from "./components/month-pace-card";
import { UpcomingBills } from "./components/upcoming-bills";
import { CashFlowChart } from "./components/cash-flow-chart";
import { AccountMix } from "./components/account-mix";
import { RecentActivity } from "./components/recent-activity";

interface DashboardClientProps {
	initialData: DashboardData;
	firstName: string | null;
}

export function DashboardClient({ initialData, firstName }: DashboardClientProps) {
	const router = useRouter();

	const { data } = useServerSyncedData<DashboardData>(initialData, () => getDashboardData());

	const [isDemo, setIsDemo] = useState(false);
	const demoTransactions = useDemoStore((state) => state.transactions);
	const recentTransactions = isDemo ? demoTransactions : data.recentTransactions;

	useEffect(() => {
		setIsDemo(isSampleDataActive());
	}, []);

	const [addTransactionOpen, setAddTransactionOpen] = useState(false);

	const handleAddTransactionSuccess = () => {
		setAddTransactionOpen(false);
		router.refresh();
	};

	return (
		<SurfacePage>
			<DashboardHeader today={data.today} firstName={firstName} onAddTransaction={() => setAddTransactionOpen(true)} />

			<NetWorthHero
				today={data.today}
				history={data.netWorth.history}
				totalAssets={data.netWorth.totalAssets}
				totalLiabilities={data.netWorth.totalLiabilities}
			/>

			<HeadsUpList items={data.headsUp} />

			{/*
			 * Two columns on desktop, stretched to the same height: cash flow grows to match the
			 * right column. On smaller screens the column wrappers dissolve (display: contents) so
			 * `order` can interleave the modules by importance.
			 */}
			<div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
				<div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-6">
					<MonthPaceCard pace={data.monthPace} today={data.today} />
					<div className="order-3 lg:order-none lg:flex-1">
						<CashFlowChart months={data.cashflow} />
					</div>
				</div>
				<div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
					<div className="order-2 lg:order-none">
						<UpcomingBills bills={data.upcomingBills} />
					</div>
					<div className="order-4 lg:order-none">
						<AccountMix accounts={data.accountsSummary} />
					</div>
				</div>
			</div>

			<RecentActivity transactions={recentTransactions} today={data.today} />

			<UnifiedTransactionDialog
				open={addTransactionOpen}
				onOpenChange={setAddTransactionOpen}
				categories={data.categories ?? []}
				accounts={data.accounts ?? []}
				onSuccess={handleAddTransactionSuccess}
			/>
		</SurfacePage>
	);
}
