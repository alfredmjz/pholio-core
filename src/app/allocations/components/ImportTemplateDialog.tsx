"use client";

import { useState } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { Button } from "@/components/ui/button";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { FileText, FolderOpen, Sparkles, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportTemplateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	monthName: string;
	year: number;
	previousMonth?: {
		name: string;
		categoryCount: number;
		totalBudget: number;
	};
	templates?: Array<{
		id: string;
		name: string;
		description?: string;
		categoryCount: number;
		totalBudget: number;
	}>;
	onImportPrevious: (expectedIncome: number) => void;
	onUseTemplate: (templateId: string, expectedIncome: number) => void;
	onStartFresh: (expectedIncome: number) => void;
	defaultExpectedIncome?: number;
}

type ImportOption = "previous" | "template" | "fresh";

const ICON_CHIP = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-muted text-primary";

function optionClass(selected: boolean) {
	return cn(
		"w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		selected ? "border-primary ring-1 ring-primary" : "border-border/80 hover:border-border-strong"
	);
}

export function ImportTemplateDialog({
	open,
	onOpenChange,
	monthName,
	year,
	previousMonth,
	templates = [],
	onImportPrevious,
	onUseTemplate,
	onStartFresh,
	defaultExpectedIncome,
}: ImportTemplateDialogProps) {
	const [selectedOption, setSelectedOption] = useState<ImportOption | null>(null);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
	const [expectedIncome, setExpectedIncome] = useState(defaultExpectedIncome ? defaultExpectedIncome.toString() : "");
	const [step, setStep] = useState<"choose" | "income">("choose");

	const handleOptionSelect = (option: ImportOption) => {
		setSelectedOption(option);
		if (option !== "template") {
			setStep("income");
		}
	};

	const handleTemplateSelect = (templateId: string) => {
		setSelectedTemplateId(templateId);
		setStep("income");
	};

	const handleContinue = () => {
		const income = parseFloat(expectedIncome) || 0;

		switch (selectedOption) {
			case "previous":
				onImportPrevious(income);
				break;
			case "template":
				if (selectedTemplateId) {
					onUseTemplate(selectedTemplateId, income);
				}
				break;
			case "fresh":
				onStartFresh(income);
				break;
		}

		setSelectedOption(null);
		setSelectedTemplateId(null);
		setExpectedIncome("");
		setStep("choose");
		onOpenChange(false);
	};

	const handleBack = () => {
		if (selectedOption === "template" && selectedTemplateId) {
			setSelectedTemplateId(null);
		} else {
			setSelectedOption(null);
		}
		setStep("choose");
	};

	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(value);
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title={
				<>
					Set up {monthName} {year}
				</>
			}
			description={
				step === "choose"
					? "This month doesn't have a budget yet. Pick a starting point."
					: "How much do you expect to earn this month?"
			}
		>
			{step === "choose" ? (
				<div className="space-y-2.5">
					{previousMonth && previousMonth.categoryCount > 0 && (
						<button
							onClick={() => handleOptionSelect("previous")}
							className={optionClass(selectedOption === "previous")}
						>
							<div className="flex items-start gap-4">
								<div className={ICON_CHIP}>
									<FileText className="h-4 w-4" />
								</div>
								<div className="flex-1">
									<div className="flex items-center justify-between">
										<h4 className="type-body font-medium text-primary">Copy {previousMonth.name}</h4>
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									</div>
									<p className="type-body-sm mt-0.5 text-muted-foreground">
										All {previousMonth.categoryCount} categories, {formatCurrency(previousMonth.totalBudget)} budgeted
									</p>
								</div>
							</div>
						</button>
					)}

					<button onClick={() => handleOptionSelect("template")} className={optionClass(selectedOption === "template")}>
						<div className="flex items-start gap-4">
							<div className={ICON_CHIP}>
								<FolderOpen className="h-4 w-4" />
							</div>
							<div className="flex-1">
								<div className="flex items-center justify-between">
									<h4 className="type-body font-medium text-primary">Use a template</h4>
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								</div>
								<p className="type-body-sm mt-0.5 text-muted-foreground">
									{templates.length > 0
										? `Choose from your ${templates.length} saved ${templates.length === 1 ? "template" : "templates"}`
										: "No templates saved yet"}
								</p>
							</div>
						</div>
					</button>

					{selectedOption === "template" && (
						<div className="ml-12 space-y-2 animate-in fade-in slide-in-from-top-2">
							{templates.length === 0 ? (
								<p className="type-body-sm py-3 text-muted-foreground">
									Set up a budget once, then use Save as template in the month menu to reuse it.
								</p>
							) : (
								templates.map((template) => (
									<button
										key={template.id}
										onClick={() => handleTemplateSelect(template.id)}
										className={cn(
											"w-full rounded-xl border p-3 text-left transition-colors hover:border-border-strong",
											selectedTemplateId === template.id ? "border-primary ring-1 ring-primary" : "border-border/80"
										)}
									>
										<div className="flex items-center justify-between w-full">
											<div className="flex-1 text-left min-w-0 pr-4">
												<h5 className="text-sm font-semibold text-primary truncate">{template.name}</h5>
												{template.description && (
													<p className="text-xs text-muted-foreground truncate opacity-90 mt-1">
														{template.description}
													</p>
												)}
											</div>
											<div className="flex items-center gap-3 shrink-0">
												<div className="text-right">
													<p className="text-sm font-semibold text-primary">{formatCurrency(template.totalBudget)}</p>
													<p className="text-xs text-muted-foreground mt-0.5">{template.categoryCount} categories</p>
												</div>
												{selectedTemplateId === template.id ? (
													<Check className="h-4 w-4 text-primary" />
												) : (
													<div className="w-4 h-4" />
												)}
											</div>
										</div>
									</button>
								))
							)}
						</div>
					)}

					<button onClick={() => handleOptionSelect("fresh")} className={optionClass(selectedOption === "fresh")}>
						<div className="flex items-start gap-4">
							<div className={ICON_CHIP}>
								<Sparkles className="h-4 w-4" />
							</div>
							<div className="flex-1">
								<div className="flex items-center justify-between">
									<h4 className="type-body font-medium text-primary">Start blank</h4>
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								</div>
								<p className="type-body-sm mt-0.5 text-muted-foreground">Add categories yourself</p>
							</div>
						</div>
					</button>
				</div>
			) : (
				<div className="space-y-6">
					<div className="space-y-2">
						<ProminentAmountInput
							id="expectedIncome"
							label={`Expected income for ${monthName}`}
							value={expectedIncome}
							onChange={setExpectedIncome}
						/>
						<p className="type-body-xs text-muted-foreground">
							Your budget is measured against this. You can change it any time.
						</p>
					</div>

					<div className="rounded-2xl bg-card-muted/50 p-4">
						<h5 className="type-label mb-2 text-muted-foreground">Starting from</h5>
						<div className="type-body-sm space-y-1.5">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Method</span>
								<span className="font-medium text-primary">
									{selectedOption === "previous"
										? `Copy of ${previousMonth?.name}`
										: selectedOption === "template"
											? templates.find((t) => t.id === selectedTemplateId)?.name
											: "Blank budget"}
								</span>
							</div>
							{selectedOption !== "fresh" && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Categories</span>
									<span className="font-medium text-primary">
										{selectedOption === "previous"
											? previousMonth?.categoryCount
											: templates.find((t) => t.id === selectedTemplateId)?.categoryCount}
									</span>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-muted-foreground">Expected income</span>
								<span className="font-medium text-primary">
									{expectedIncome ? formatCurrency(parseFloat(expectedIncome)) : "Not set"}
								</span>
							</div>
						</div>
					</div>

					<div className="flex gap-3">
						<Button variant="outline" onClick={handleBack} className="flex-1">
							Back
						</Button>
						<Button onClick={handleContinue} className="flex-1">
							Continue
						</Button>
					</div>
				</div>
			)}
		</ControlBasedDialog>
	);
}
