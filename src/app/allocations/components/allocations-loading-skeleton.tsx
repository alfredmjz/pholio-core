import { Skeleton } from "@/components/ui/skeleton";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

export function AllocationsLoadingSkeleton() {
	return (
		<PageShell>
			<PageHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Skeleton className="h-10 w-32" />
						<Skeleton className="h-10 w-48" />
					</div>
					<div className="flex items-center gap-2">
						<Skeleton className="h-9 w-24" />
						<Skeleton className="h-9 w-9" />
						<Skeleton className="h-9 w-32" />
					</div>
				</div>
			</PageHeader>

			<PageContent>
				<div className="flex flex-col gap-6">
					{/* Main content: 60/40 split */}
					<div className="flex flex-col lg:flex-row gap-6">
						{/* Left column: Summary cards + Spending Allocation */}
						<div className="w-full lg:w-[60%] flex flex-col gap-6">
							{/* Budget Summary Cards (3 cards) */}
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{[1, 2, 3].map((i) => (
									<div key={i} className="rounded-xl border border-border bg-card p-5">
										<Skeleton className="h-4 w-24 mb-2" />
										<Skeleton className="h-8 w-28" />
										<Skeleton className="h-3 w-16 mt-2" />
									</div>
								))}
							</div>

							{/* Spending Allocation */}
							<div className="rounded-xl border border-border bg-card p-6">
								<Skeleton className="h-4 w-36 mb-1" />
								<Skeleton className="h-3 w-28 mb-4" />
								<div className="flex items-center justify-end mb-4">
									<Skeleton className="h-6 w-32" />
								</div>
								<Skeleton className="h-6 w-full rounded-full mb-6" />
								<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
									{[1, 2, 3, 4].map((i) => (
										<div key={i} className="flex items-center gap-2">
											<Skeleton className="h-3 w-3 rounded-full" />
											<div>
												<Skeleton className="h-3 w-16 mb-1" />
												<Skeleton className="h-3 w-10" />
											</div>
										</div>
									))}
								</div>
							</div>
						</div>

						{/* Right column: Spending Pace */}
						<div className="w-full lg:w-[40%] flex flex-col">
							<div className="rounded-xl border border-border bg-card p-6 flex-1 flex flex-col">
								<Skeleton className="h-4 w-24 mb-4" />
								<Skeleton className="h-8 w-32 mb-1" />
								<Skeleton className="h-3 w-48 mb-6" />
								<div className="flex-1 min-h-[150px]">
									<Skeleton className="h-full w-full rounded-lg" />
								</div>
							</div>
						</div>
					</div>

					{/* Category Performance */}
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between px-2 md:px-0">
							<Skeleton className="h-4 w-36" />
							<Skeleton className="h-9 w-28" />
						</div>
						<div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-4">
							{[1, 2, 3, 4].map((i) => (
								<div key={i} className="rounded-xl border border-border bg-card p-4">
									<div className="flex justify-between mb-3">
										<Skeleton className="h-4 w-24" />
										<Skeleton className="h-4 w-16" />
									</div>
									<Skeleton className="h-2 w-full rounded-full mb-2" />
									<Skeleton className="h-3 w-20" />
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Transaction Ledger */}
				<div className="rounded-xl border border-border bg-card p-6 mt-6">
					<div className="mb-4">
						<Skeleton className="h-5 w-40 mb-1" />
						<Skeleton className="h-3 w-48" />
					</div>

					<div className="flex gap-3 mb-6">
						<Skeleton className="h-10 flex-1 max-w-md" />
						<Skeleton className="h-10 w-48" />
						<Skeleton className="h-10 w-44" />
						<Skeleton className="h-10 w-10" />
					</div>

					<div className="border border-border rounded-lg overflow-hidden">
						<div className="bg-muted/50 border-b border-border p-3 flex justify-between">
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-20" />
						</div>

						{[1, 2, 3, 4, 5].map((i) => (
							<div key={i} className="p-4 flex items-center justify-between border-b border-border last:border-0">
								<Skeleton className="h-4 w-20" />
								<div className="flex-1 px-4">
									<Skeleton className="h-4 w-48 mb-1" />
									<Skeleton className="h-3 w-24" />
								</div>
								<Skeleton className="h-6 w-24 mx-4" />
								<Skeleton className="h-5 w-20 mx-4" />
								<Skeleton className="h-5 w-20" />
							</div>
						))}
					</div>
				</div>
			</PageContent>
		</PageShell>
	);
}
