import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { REGISTERED_PLANS, getContributionPlanLabel } from "@/lib/contribution-plans";
import type { RegisteredPlan } from "@/app/balancesheet/types";

interface ContributionPlanPickerProps {
	value: RegisteredPlan | null;
	onChange: (plan: RegisteredPlan | null) => void;
	/** Plans already linked to another category this month (one category per plan). */
	takenPlans?: RegisteredPlan[];
	/** Adds a "None" option so a link can be removed. */
	allowNone?: boolean;
	size?: "sm" | "default";
	className?: string;
}

const NONE = "none";

/** Segmented choice of the registered plan a budget category counts toward. */
export function ContributionPlanPicker({
	value,
	onChange,
	takenPlans = [],
	allowNone = false,
	size = "default",
	className,
}: ContributionPlanPickerProps) {
	// The segmented "on" fill is bg-card, which is faint inside cards and dialogs, so add a ring.
	const itemClass = cn(
		"data-[state=on]:ring-1 data-[state=on]:ring-ring",
		size === "sm" ? "h-6 px-2 type-caption" : "px-3 py-1.5 type-body-xs"
	);

	return (
		<ToggleGroup
			type="single"
			variant="segmented"
			aria-label="Registered plan"
			value={value ?? (allowNone ? NONE : "")}
			onValueChange={(next) => {
				if (!next) return;
				onChange(next === NONE ? null : (next as RegisteredPlan));
			}}
			className={cn("w-full justify-start rounded-lg border border-border/60 bg-background p-1", className)}
		>
			{allowNone && (
				<ToggleGroupItem value={NONE} className={cn("flex-1", itemClass)}>
					None
				</ToggleGroupItem>
			)}
			{REGISTERED_PLANS.map((plan) => {
				const taken = takenPlans.includes(plan) && plan !== value;
				return (
					<ToggleGroupItem
						key={plan}
						value={plan}
						disabled={taken}
						aria-label={getContributionPlanLabel(plan)}
						title={taken ? `Another category already tracks ${getContributionPlanLabel(plan)} room` : undefined}
						className={cn("flex-1", itemClass)}
					>
						{getContributionPlanLabel(plan)}
					</ToggleGroupItem>
				);
			})}
		</ToggleGroup>
	);
}
