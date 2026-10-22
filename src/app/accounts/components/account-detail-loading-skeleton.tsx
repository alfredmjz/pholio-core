import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the account detail layout so content doesn't jump when it arrives. */
export function AccountDetailLoadingSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pb-16 pt-6 md:gap-10 md:px-8 md:pt-10">
			<div className="flex flex-col gap-4">
				<Skeleton className="h-4 w-24" />
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div className="flex items-center gap-3.5">
						<Skeleton className="h-11 w-11 rounded-full" />
						<div className="space-y-2">
							<Skeleton className="h-8 w-48" />
							<Skeleton className="h-4 w-32" />
						</div>
					</div>
					<div className="flex gap-2">
						<Skeleton className="h-10 w-36 rounded-full" />
						<Skeleton className="h-10 w-40 rounded-full" />
					</div>
				</div>
			</div>
			<Skeleton className="h-[420px] w-full rounded-[22px]" />
			<div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
				<Skeleton className="h-96 w-full rounded-[22px] lg:col-span-8" />
				<Skeleton className="h-72 w-full rounded-[22px] lg:col-span-4" />
			</div>
		</div>
	);
}
