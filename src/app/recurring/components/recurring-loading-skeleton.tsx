import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

export function RecurringLoadingSkeleton() {
	return (
		<PageShell className="space-y-6">
			{/* Header */}
			<PageHeader className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
				<div className="space-y-2">
					<Skeleton className="h-9 w-40" />
					<Skeleton className="h-5 w-64" />
				</div>
				<Skeleton className="h-10 w-32" />
			</PageHeader>

			<PageContent>
				{/* Summary Cards */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-36" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-12" />
						</CardContent>
					</Card>
				</div>

				{/* Tabs and Content */}
				<div className="space-y-4">
					<div className="flex space-x-2">
						<Skeleton className="h-10 w-28" />
						<Skeleton className="h-10 w-16" />
					</div>

					{/* Subscription List Skeleton */}
					<Card>
						<div className="divide-y">
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className="flex items-center justify-between p-4">
									<div className="flex items-center gap-4">
										<Skeleton className="h-10 w-10 rounded-full" />
										<div className="space-y-2">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-3 w-24" />
										</div>
									</div>
									<div className="flex items-center gap-4">
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-8 w-12 rounded-full" />
									</div>
								</div>
							))}
						</div>
					</Card>
				</div>
			</PageContent>
		</PageShell>
	);
}
