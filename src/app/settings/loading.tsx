import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the Settings layout so content doesn't jump when it arrives. */
export default function Loading() {
	return (
		<div className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-4 pb-16 pt-6 md:gap-10 md:px-8 md:pt-10">
			<div className="space-y-2">
				<Skeleton className="h-9 w-40" />
				<Skeleton className="h-5 w-64" />
			</div>
			<div className="xl:grid xl:grid-cols-[180px_minmax(0,1fr)] xl:gap-10">
				<Skeleton className="mb-4 h-11 w-full rounded-full xl:mb-0 xl:h-72 xl:rounded-xl" />
				<div className="flex flex-col gap-6">
					<Skeleton className="h-48 w-full rounded-[22px]" />
					<Skeleton className="h-32 w-full rounded-[22px]" />
					<Skeleton className="h-44 w-full rounded-[22px]" />
				</div>
			</div>
		</div>
	);
}
