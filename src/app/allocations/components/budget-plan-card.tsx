"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCircle2, CircleDashed, Clock, Pencil, TrendingDown, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/app/dashboard/utils";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import type { AllocationContributions } from "@/lib/types/contribution";
import { updateExpectedIncome } from "../actions";
import { buildBudgetPlan } from "../budget-plan";
import type { AllocationCategory, IncomeVerificationResult } from "../types";
import { getCategoryColor } from "../utils/colors";
import { getCategoryFigures } from "../utils/category-figures";

interface BudgetPlanCardProps {
	expectedIncome: number;
	categories: AllocationCategory[];
	contributions: AllocationContributions;
	incomeVerification: IncomeVerificationResult;
	allocationId?: string;
}

/** Faint diagonal hatching for income that no budget has claimed. */
const UNBUDGETED_STYLE = {
	backgroundImage:
		"repeating-linear-gradient(135deg, hsl(var(--foreground) / 0.1) 0 2px, transparent 2px 6px), linear-gradient(hsl(var(--foreground) / 0.04), hsl(var(--foreground) / 0.04))",
};

function VerificationBadge({ verification }: { verification: IncomeVerificationResult }) {
	if (verification.status === "verified") {
		return (
			<span
				className="inline-flex items-center gap-1 text-success"
				title={`Income matched for ${verification.consecutiveMatches} months in a row`}
			>
				<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
				Verified
			</span>
		);
	}
	if (verification.status === "tracking") {
		const remaining = 3 - verification.consecutiveMatches;
		return (
			<span
				className="inline-flex items-center gap-1 text-warning"
				title={`${remaining} more month${remaining === 1 ? "" : "s"} of matching income to verify`}
			>
				<Clock className="h-3.5 w-3.5" aria-hidden />
				Checking
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 text-muted-foreground">
			<CircleDashed className="h-3.5 w-3.5" aria-hidden />
			Not set
		</span>
	);
}

/**
 * The month at a glance: what was planned out of expected income, as one ribbon where each
 * budget is filled by its spending and the unbudgeted rest is hatched.
 */
export function BudgetPlanCard({
	expectedIncome,
	categories,
	contributions,
	incomeVerification,
	allocationId,
}: BudgetPlanCardProps) {
	const router = useRouter();
	const [isEditing, setIsEditing] = useState(false);
	const [incomeDraft, setIncomeDraft] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [active, setActive] = useState<string | null>(null);
	const [driftDismissed, setDriftDismissed] = useState(true);

	useEffect(() => {
		try {
			setDriftDismissed(allocationId ? localStorage.getItem(`dismissed-drift-${allocationId}`) === "true" : false);
		} catch {
			setDriftDismissed(false);
		}
	}, [allocationId]);

	const colorFor = useMemo(() => {
		const map = new Map(categories.map((c) => [c.id, getCategoryColor(c.id, c.color, c.display_order)]));
		return (id: string) => map.get(id) ?? getCategoryColor(id);
	}, [categories]);

	const plan = useMemo(
		() =>
			buildBudgetPlan(
				expectedIncome,
				categories.map((c) => {
					const figures = getCategoryFigures(c, contributions);
					return { id: c.id, name: c.name, budget: figures.budget, spent: figures.spent };
				})
			),
		[expectedIncome, categories, contributions]
	);

	const saveIncome = async (value: number) => {
		if (!allocationId) return;
		setIsSaving(true);
		try {
			if (await updateExpectedIncome(allocationId, value)) {
				toast.success("Expected income updated");
				router.refresh();
			} else {
				toast.error("Couldn't update expected income", { description: "Try again in a moment." });
			}
		} finally {
			setIsSaving(false);
			setIsEditing(false);
		}
	};

	const commitIncome = () => {
		const value = parseFloat(incomeDraft) || 0;
		if (value === expectedIncome) setIsEditing(false);
		else saveIncome(value);
	};

	const dismissDrift = () => {
		setDriftDismissed(true);
		try {
			if (allocationId) localStorage.setItem(`dismissed-drift-${allocationId}`, "true");
		} catch {
			// Remembering the dismissal is a convenience; the banner just returns next visit.
		}
	};

	const drift = incomeVerification.drift;
	const showDrift = !!drift?.detected && !driftDismissed && !!allocationId;

	const activeSegment = plan.segments.find((s) => s.id === active);
	const caption = activeSegment
		? `${activeSegment.name}: ${formatCurrency(activeSegment.spent)} of ${formatCurrency(activeSegment.budget)}${
				activeSegment.overBy > 0 ? `, ${formatCurrency(activeSegment.overBy)} over` : ""
			}`
		: active === "unbudgeted"
			? `Not budgeted: ${formatCurrency(Math.max(0, plan.notBudgeted))}${
					plan.unbudgetedSpent > 0 ? `, ${formatCurrency(plan.unbudgetedSpent)} spent without a budget` : ""
				}`
			: "Each budget fills as you spend. Point at one to see it.";

	return (
		<section aria-labelledby="plan-heading" className="flex flex-col gap-5">
			<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
				<div className="min-w-0">
					<h2 id="plan-heading" className="type-label text-muted-foreground">
						Planned this month
					</h2>
					<p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<span className="type-display tabular-nums text-primary">{formatCurrency(plan.budgeted)}</span>
						<span className="type-body-lg text-muted-foreground">of expected income</span>
					</p>
				</div>

				<div className="flex flex-col items-start gap-1 sm:items-end">
					{isEditing ? (
						<div className="flex items-center gap-1.5">
							<span className="type-h4 text-muted-foreground">$</span>
							<input
								type="text"
								inputMode="decimal"
								aria-label="Expected income"
								value={incomeDraft}
								onChange={(e) => setIncomeDraft(sanitizeDecimalInput(e.target.value, 2))}
								onKeyDown={(e) => {
									if (e.key === "Enter") commitIncome();
									if (e.key === "Escape") setIsEditing(false);
								}}
								autoFocus
								disabled={isSaving}
								placeholder="0.00"
								className="type-h4 w-32 border-b-2 border-field-focus bg-transparent tabular-nums text-primary outline-none"
							/>
							<button
								type="button"
								onClick={commitIncome}
								disabled={isSaving}
								className="rounded-full p-1.5 text-success hover:bg-success-muted"
								aria-label="Save expected income"
							>
								<Check className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								disabled={isSaving}
								className="rounded-full p-1.5 text-muted-foreground hover:bg-hover"
								aria-label="Cancel"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={() => {
								setIncomeDraft(expectedIncome > 0 ? String(expectedIncome) : "");
								setIsEditing(true);
							}}
							className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 backdrop-blur-sm transition-colors hover:border-border-strong"
						>
							<span className="type-body-sm text-muted-foreground">Expected income</span>
							<span className="type-value text-primary">{formatCurrency(expectedIncome)}</span>
							<Pencil className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" aria-hidden />
							<span className="sr-only">Edit expected income</span>
						</button>
					)}
					<span className="type-body-xs px-1">
						<VerificationBadge verification={incomeVerification} />
					</span>
				</div>
			</div>

			<div>
				<div
					className="flex h-7 w-full gap-[3px] overflow-hidden rounded-full"
					role="group"
					aria-label="Budget plan by category"
					onMouseLeave={() => setActive(null)}
				>
					{plan.segments.map((segment) => {
						const color = colorFor(segment.id);
						return (
							<button
								key={segment.id}
								type="button"
								className="relative h-full min-w-[3px] overflow-hidden first:rounded-l-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
								style={{ width: `${segment.widthPercent}%` }}
								aria-label={`${segment.name}: ${formatCurrency(segment.spent)} spent of ${formatCurrency(segment.budget)}`}
								onMouseEnter={() => setActive(segment.id)}
								onFocus={() => setActive(segment.id)}
								onClick={() => setActive(segment.id)}
								onBlur={() => setActive(null)}
							>
								<span className={cn("absolute inset-0 opacity-25", color.bg)} />
								<span
									className={cn("absolute inset-y-0 left-0", color.bg)}
									style={{ width: `${segment.fillPercent}%` }}
								/>
								{segment.overBy > 0 && <span className="absolute inset-y-0 right-0 w-1 bg-error" />}
							</button>
						);
					})}
					{plan.remainder.widthPercent > 0 && (
						<button
							type="button"
							className="relative h-full overflow-hidden rounded-r-full first:rounded-l-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
							style={{ width: `${plan.remainder.widthPercent}%`, ...UNBUDGETED_STYLE }}
							aria-label={`Not budgeted: ${formatCurrency(Math.max(0, plan.notBudgeted))}`}
							onMouseEnter={() => setActive("unbudgeted")}
							onFocus={() => setActive("unbudgeted")}
							onClick={() => setActive("unbudgeted")}
							onBlur={() => setActive(null)}
						>
							<span
								className="absolute inset-y-0 left-0 bg-primary/30"
								style={{ width: `${plan.remainder.fillPercent}%` }}
							/>
						</button>
					)}
					{plan.segments.length === 0 && plan.remainder.widthPercent === 0 && (
						<div className="h-full w-full rounded-full bg-primary/[0.06]" />
					)}
				</div>
				<p className="type-body-xs mt-2 min-h-[1.2em] text-muted-foreground" aria-live="polite">
					{caption}
				</p>
			</div>

			<dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/70 pt-5 sm:grid-cols-4">
				<div>
					<dt className="type-body-xs text-muted-foreground">Spent</dt>
					<dd className="type-stat mt-1 text-primary">{formatCurrency(plan.spent)}</dd>
				</div>
				<div>
					<dt className="type-body-xs text-muted-foreground">Left in budgets</dt>
					<dd className="type-stat mt-1 text-primary">{formatCurrency(plan.leftInBudget)}</dd>
				</div>
				<div>
					<dt className="type-body-xs text-muted-foreground">Over budget</dt>
					<dd className={cn("type-stat mt-1", plan.overBudget > 0 ? "text-error" : "text-primary")}>
						{formatCurrency(plan.overBudget)}
					</dd>
				</div>
				<div>
					<dt className="type-body-xs text-muted-foreground">
						{plan.overAllocated ? "Planned past income" : "Not budgeted"}
					</dt>
					<dd className={cn("type-stat mt-1", plan.overAllocated ? "text-error" : "text-success")}>
						{formatCurrency(Math.abs(plan.notBudgeted))}
					</dd>
				</div>
			</dl>

			{showDrift && drift && (
				<div className="surface-sheet flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
					{drift.direction === "increase" ? (
						<TrendingUp className="h-5 w-5 shrink-0 text-success" aria-hidden />
					) : (
						<TrendingDown className="h-5 w-5 shrink-0 text-warning" aria-hidden />
					)}
					<p className="type-body-sm min-w-0 flex-1 text-primary">
						Your income has been about {formatCurrency(drift.suggestedAmount)} for {drift.monthsObserved} months.
						<span className="text-muted-foreground"> Use that as expected income?</span>
					</p>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={async () => {
								await saveIncome(drift.suggestedAmount);
								dismissDrift();
							}}
							disabled={isSaving}
							className="type-control rounded-full bg-primary px-3.5 py-1.5 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
						>
							{isSaving ? "Updating…" : `Use ${formatCurrency(drift.suggestedAmount)}`}
						</button>
						<button
							type="button"
							onClick={dismissDrift}
							className="rounded-full p-1.5 text-muted-foreground hover:bg-hover hover:text-primary"
							aria-label="Dismiss"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}
		</section>
	);
}
