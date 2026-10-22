import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the Recurring layout so content doesn't jump when it arrives. */
export function RecurringLoadingSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pb-16 pt-6 md:gap-10 md:px-8 md:pt-10">
			<div className="flex items-end justify-between gap-4">
				<div className="space-y-2">
					<Skeleton className="h-9 w-44" />
					<Skeleton className="h-5 w-64" />
				</div>
				<Skeleton className="h-10 w-36 rounded-full" />
			</div>
			<Skeleton className="h-52 w-full rounded-[22px]" />
			<Skeleton className="h-72 w-full rounded-[22px]" />
			<Skeleton className="h-96 w-full rounded-[22px]" />
		</div>
	);
}
