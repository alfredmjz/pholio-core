import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the Allocations layout so content doesn't jump when it arrives. */
export function AllocationsLoadingSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pb-16 pt-6 md:gap-10 md:px-8 md:pt-10">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Skeleton className="h-9 w-44" />
					<Skeleton className="h-10 w-28 rounded-full" />
				</div>
				<Skeleton className="h-10 w-40 rounded-full" />
			</div>
			<div className="flex flex-col gap-4">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-16 w-56" />
				<Skeleton className="h-4 w-full rounded-full" />
			</div>
			<div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
				{Array.from({ length: 4 }, (_, i) => (
					<div key={i} className="space-y-2">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-7 w-24" />
					</div>
				))}
			</div>
			<Skeleton className="h-96 w-full rounded-[22px]" />
		</div>
	);
}
