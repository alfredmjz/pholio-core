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
				<div className="flex flex-col lg:flex-row gap-6">
					<div className="flex-1 lg:flex-[3] flex flex-col gap-6">
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							{[1, 2, 3, 4].map((i) => (
								<div key={i} className="rounded-xl border border-border bg-card text-card shadow p-6">
									<Skeleton className="h-4 w-24 mb-2" />
									<Skeleton className="h-8 w-32" />
								</div>
							))}
						</div>

						<div className="rounded-xl border border-border bg-card text-card shadow h-[400px] p-6">
							<div className="space-y-4">
								<div className="flex justify-between items-center mb-6">
									<Skeleton className="h-6 w-48" />
									<Skeleton className="h-9 w-24" />
								</div>
								{[1, 2, 3, 4, 5].map((i) => (
									<div key={i} className="space-y-2">
										<div className="flex justify-between">
											<Skeleton className="h-4 w-32" />
											<Skeleton className="h-4 w-24" />
										</div>
										<Skeleton className="h-3 w-full" />
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="lg:flex-[1]">
						<div className="rounded-xl border border-border bg-card text-card shadow h-[400px] p-6 flex items-center justify-center">
							<Skeleton className="h-48 w-48 rounded-full" />
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-border bg-card text-card shadow p-6 mt-6">
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
							<div
								key={i}
								className="p-4 flex items-center justify-between border-b border-border last:border-0 hover:bg-muted/30"
							>
								<Skeleton className="h-4 w-20" />
								<div className="flex-1 px-4">
									<Skeleton className="h-4 w-48 mb-1" />
									<Skeleton className="h-3 w-24" />
								</div>
								<Skeleton className="h-6 w-24 mx-4" />
								<Skeleton className="h-5 w-20 mx-4" />
								<Skeleton className="h-5 w-20 text-right" />
							</div>
						))}
					</div>
				</div>
			</PageContent>
		</PageShell>
	);
}
