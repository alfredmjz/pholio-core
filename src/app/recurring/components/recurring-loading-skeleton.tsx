import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

export function RecurringLoadingSkeleton() {
	return (
		<PageShell className="space-y-6">
			<HeaderSkeleton />

			<PageContent>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<SummaryCardSkeleton />
					<SummaryCardSkeleton />
				</div>

				<div className="space-y-4">
					<TabsSkeleton />
					<div className="flex flex-col gap-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<SubscriptionCardSkeleton key={i} />
						))}
					</div>
				</div>
			</PageContent>
		</PageShell>
	);
}

function HeaderSkeleton() {
	return (
		<PageHeader className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
			<div className="space-y-2">
				<Skeleton className="h-9 w-40" />
				<Skeleton className="h-5 w-64" />
			</div>
			<Skeleton className="h-10 w-32" />
		</PageHeader>
	);
}

function SummaryCardSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-4 w-4" />
			</CardHeader>
			<CardContent>
				<Skeleton className="h-8 w-24 mb-1" />
				<Skeleton className="h-3 w-40" />
			</CardContent>
		</Card>
	);
}

function TabsSkeleton() {
	return (
		<div className="flex space-x-2">
			<Skeleton className="h-10 w-28" />
			<Skeleton className="h-10 w-16" />
		</div>
	);
}

function SubscriptionCardSkeleton() {
	return (
		<Card className="border-border/60">
			<CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
				<div className="flex items-center gap-5">
					<Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
					<div className="space-y-2">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-4 w-32" />
					</div>
				</div>

				<div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8 w-full sm:w-auto">
					<div className="flex flex-col items-end gap-1">
						<Skeleton className="h-3 w-12" />
						<Skeleton className="h-8 w-28" />
					</div>
					<Skeleton className="h-8 w-12 rounded-md" />
				</div>
			</CardContent>
		</Card>
	);
}
