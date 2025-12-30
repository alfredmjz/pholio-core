import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardLoadingSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="space-y-2">
				<Skeleton className="h-9 w-48" />
				<Skeleton className="h-5 w-72" />
			</div>

			{/* Metric Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<Card key={i}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-4" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-28 mb-2" />
							<Skeleton className="h-3 w-32" />
						</CardContent>
					</Card>
				))}
			</div>

			{/* Main widgets row */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Net Worth Widget */}
				<Card className="lg:col-span-1">
					<CardHeader>
						<Skeleton className="h-6 w-32" />
						<Skeleton className="h-4 w-48" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-[200px] w-full" />
					</CardContent>
				</Card>

				{/* Cashflow Widget */}
				<Card className="lg:col-span-1">
					<CardHeader>
						<Skeleton className="h-6 w-36" />
						<Skeleton className="h-4 w-52" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-[200px] w-full" />
					</CardContent>
				</Card>
			</div>

			{/* Recent Transactions */}
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-40" />
					<Skeleton className="h-4 w-56" />
				</CardHeader>
				<CardContent>
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
				</CardContent>
			</Card>
		</div>
	);
}
