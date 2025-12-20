import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton for transaction list items.
 */
export function TransactionSkeleton() {
	return (
		<div className="flex flex-col gap-2">
			{[1, 2, 3].map((i) => (
				<div key={i} className="flex items-center justify-between p-3 rounded-lg border">
					<div className="flex-1 flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-5 w-16" />
						</div>
						<Skeleton className="h-4 w-32" />
					</div>
					<Skeleton className="h-6 w-20" />
				</div>
			))}
		</div>
	);
}
