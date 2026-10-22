import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the Accounts layout so content doesn't jump when it arrives. */
export function AccountsLoadingSkeleton() {
	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pb-16 pt-6 md:gap-10 md:px-8 md:pt-10">
			<div className="flex items-end justify-between gap-4">
				<div className="space-y-2">
					<Skeleton className="h-9 w-44" />
					<Skeleton className="h-5 w-56" />
				</div>
				<Skeleton className="h-10 w-36 rounded-full" />
			</div>
			<div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
				{Array.from({ length: 4 }, (_, i) => (
					<div key={i} className="space-y-2">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-7 w-28" />
					</div>
				))}
			</div>
			<div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
				<div className="flex flex-col gap-5 lg:col-span-8 lg:gap-6">
					<Skeleton className="h-80 w-full rounded-[22px]" />
					<Skeleton className="h-56 w-full rounded-[22px]" />
				</div>
				<Skeleton className="h-96 w-full rounded-[22px] lg:col-span-4" />
			</div>
		</div>
	);
}
