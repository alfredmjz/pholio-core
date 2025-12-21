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
				{/* Top Row: Net Worth Summary Skeleton */}
				<div className="w-full">
					<Skeleton className="h-[120px] w-full rounded-xl" />
				</div>

				{/* Master-Detail Layout */}
				<div className="flex gap-6 min-h-[600px]">
					{/* Sidebar skeleton */}
					<div className="w-80 space-y-4">
						<Skeleton className="h-10 w-full" />
						<div className="space-y-2">
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					</div>

					{/* Main panel skeleton */}
					<div className="flex-1">
						<Skeleton className="h-full w-full rounded-xl shadow-lg" />
					</div>
				</div>
			</PageContent>
		</PageShell>
	);
}
