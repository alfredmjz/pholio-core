import { Skeleton } from "@/components/ui/skeleton";

export function SettingsLoadingSkeleton() {
	return (
		<div className="space-y-6 animate-in fade-in duration-500">
			{/* Section Header */}
			<div className="pb-3 border-b border-border space-y-2">
				<Skeleton className="h-7 w-48" />
				<Skeleton className="h-4 w-64" />
			</div>

			{/* Main Content */}
			<div className="space-y-6 max-w-2xl">
				{/* Avatar Row (if profile) or generic content */}
				<div className="flex items-center gap-4">
					<Skeleton className="h-16 w-16 rounded-full" />
					<div className="space-y-2">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-48" />
					</div>
				</div>

				{/* Form Fields */}
				<div className="space-y-5">
					{[1, 2, 3].map((i) => (
						<div key={i} className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-11 w-full rounded-md" />
						</div>
					))}
				</div>

				{/* Divider */}
				<div className="pt-4 border-t border-border">
					<Skeleton className="h-4 w-40" />
				</div>
			</div>
		</div>
	);
}
