import { Skeleton } from "@/components/ui/skeleton";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

export function AccountDetailLoadingSkeleton() {
	return (
		<PageShell>
			{/* Header */}
			<PageHeader isSticky={false} className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<Skeleton className="h-10 w-10 rounded-md" /> {/* Back button */}
					<div>
						<Skeleton className="h-8 w-48 mb-2" /> {/* Title */}
						<Skeleton className="h-4 w-32" /> {/* Subtitle */}
					</div>
				</div>
				<Skeleton className="h-10 w-10 rounded-md" /> {/* Delete button */}
			</PageHeader>

			<PageContent>
				{/* Main grid layout - flex for responsiveness */}
				<div className="flex flex-col lg:flex-row gap-6">
					{/* Left Column - Main Content */}
					<div className="flex-1 flex flex-col gap-6 min-w-0">
						{/* Balance Card Skeleton */}
						<div className="rounded-xl border border-border bg-card p-6 h-[200px]">
							<div className="space-y-4">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-12 w-64" />
								<div className="flex gap-4">
									<Skeleton className="h-20 w-full" />
									<Skeleton className="h-20 w-full" />
								</div>
							</div>
						</div>

						{/* Insights Card Skeleton */}
						<div className="rounded-xl border border-border bg-card p-6 h-[250px]">
							<Skeleton className="h-6 w-32 mb-4" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-32 w-full" />
								<Skeleton className="h-32 w-full" />
							</div>
						</div>

						{/* Activity Card Skeleton */}
						<div className="rounded-xl border border-border bg-card p-6 min-h-[400px]">
							<Skeleton className="h-6 w-32 mb-6" />
							<div className="space-y-4">
								{[1, 2, 3, 4, 5].map((i) => (
									<div key={i} className="flex items-center justify-between">
										<div className="flex items-center gap-4">
											<Skeleton className="h-10 w-10 rounded-full" />
											<div className="space-y-2">
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-3 w-24" />
											</div>
										</div>
										<Skeleton className="h-4 w-20" />
									</div>
								))}
							</div>
						</div>
					</div>

					{/* Right Column - Sidebar */}
					<div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
						{/* Quick Actions Skeleton */}
						<div className="rounded-xl border border-border bg-card p-6">
							<Skeleton className="h-6 w-32 mb-4" />
							<div className="grid grid-cols-2 gap-3">
								<Skeleton className="h-20 w-full" />
								<Skeleton className="h-20 w-full" />
							</div>
						</div>

						{/* Performance Skeleton */}
						<div className="rounded-xl border border-border bg-card p-6 h-[200px]">
							<Skeleton className="h-6 w-32 mb-4" />
							<Skeleton className="h-32 w-full" />
						</div>

						{/* Notes Skeleton */}
						<div className="rounded-xl border border-border bg-card p-6 h-[150px]">
							<Skeleton className="h-6 w-24 mb-4" />
							<Skeleton className="h-24 w-full" />
						</div>

						{/* Other Accounts Skeleton */}
						<div className="rounded-xl border border-border bg-card p-6">
							<Skeleton className="h-6 w-36 mb-4" />
							<div className="space-y-3">
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
							</div>
						</div>
					</div>
				</div>
			</PageContent>
		</PageShell>
	);
}
