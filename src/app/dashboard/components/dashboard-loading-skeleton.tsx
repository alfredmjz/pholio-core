import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dashboard layout so content does not jump when it arrives. */
export function DashboardLoadingSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pb-16 pt-6 md:gap-10 md:px-8 md:pt-10">
			<div className="space-y-2">
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-8 w-64" />
			</div>

			<div className="space-y-4">
				<Skeleton className="h-3 w-20" />
				<Skeleton className="h-16 w-72 max-w-full" />
				<Skeleton className="h-5 w-56" />
				<Skeleton className="h-[170px] w-full rounded-2xl md:h-[230px]" />
			</div>

			<div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
				<div className="flex flex-col gap-5 lg:col-span-7 lg:gap-6">
					<Skeleton className="h-56 w-full rounded-[22px]" />
					<Skeleton className="h-72 w-full rounded-[22px]" />
				</div>
				<div className="flex flex-col gap-5 lg:col-span-5 lg:gap-6">
					<Skeleton className="h-64 w-full rounded-[22px]" />
					<Skeleton className="h-64 w-full rounded-[22px]" />
				</div>
			</div>
		</div>
	);
}
