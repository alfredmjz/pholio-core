import { Skeleton } from "@/components/ui/skeleton";

export function BalanceSheetLoadingSkeleton() {
	return (
		<div className="flex h-[calc(100vh-80px)] gap-6">
			{/* Sidebar skeleton */}
			<div className="w-80 space-y-4">
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-10 w-full" />
				<div className="space-y-2">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			</div>

			{/* Main panel skeleton */}
			<div className="flex-1">
				<Skeleton className="h-full w-full" />
			</div>
		</div>
	);
}
