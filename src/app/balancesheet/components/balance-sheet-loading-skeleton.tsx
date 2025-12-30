import { Skeleton } from "@/components/ui/skeleton";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

export function BalanceSheetLoadingSkeleton() {
	return (
		<PageShell>
			<PageHeader isSticky={false}>
				<div className="flex items-center justify-between">
					<div className="space-y-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-64" />
					</div>
					<Skeleton className="h-10 w-32" />
				</div>
			</PageHeader>

			<PageContent>
				<div className="flex flex-col gap-6">
					{/* Top Cards Row: Net Worth, Asset Growth, Debt Rundown */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{[...Array(3)].map((_, i) => (
							<Skeleton key={i} className="h-[140px] w-full rounded-xl" />
						))}
					</div>

					{/* Main Content: Account List and Activity */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
						{/* All Accounts List Skeleton (2 cols) */}
						<div className="lg:col-span-2 rounded-xl border border-border bg-card text-card-foreground shadow-sm h-[600px] flex flex-col overflow-hidden">
							{/* Card Header Skeleton */}
							<div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
								<div className="space-y-2">
									<Skeleton className="h-6 w-32" />
									<Skeleton className="h-4 w-24" />
								</div>
								<div className="flex gap-2 w-full sm:w-auto">
									<Skeleton className="h-10 w-full sm:w-64" />
									<Skeleton className="h-10 w-[120px]" />
								</div>
							</div>

							{/* Account Items Skeleton */}
							<div className="flex-1 p-6 space-y-4">
								{[...Array(5)].map((_, i) => (
									<div key={i} className="flex items-center gap-4 border border-border p-4 rounded-lg">
										<Skeleton className="h-10 w-10 rounded-full" />
										<div className="space-y-2 flex-1">
											<Skeleton className="h-5 w-48" />
											<Skeleton className="h-4 w-32" />
										</div>
										<Skeleton className="h-8 w-24" />
									</div>
								))}
							</div>
						</div>

						{/* Recent Activity Skeleton (1 col) */}
						<div className="lg:col-span-1 rounded-xl border border-border bg-card h-[400px] p-6 space-y-6">
							<Skeleton className="h-6 w-40 mb-4" />
							{[...Array(4)].map((_, i) => (
								<div key={i} className="flex gap-4">
									<Skeleton className="h-8 w-8 rounded-full" />
									<div className="space-y-2 flex-1">
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-3 w-1/2" />
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</PageContent>
		</PageShell>
	);
}
