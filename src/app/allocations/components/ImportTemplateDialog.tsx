"use client";

import { useState } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
}

type ImportOption = "previous" | "template" | "fresh";

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
}: ImportTemplateDialogProps) {
	const [selectedOption, setSelectedOption] = useState<ImportOption | null>(null);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
	const [expectedIncome, setExpectedIncome] = useState("");
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
					Set Up {monthName} {year}
				</>
			}
			description={
				step === "choose"
					? "This month doesn't have a budget yet. How would you like to get started?"
					: "Set your expected income for this month"
			}
			className="sm:max-w-[500px]"
		>
			{step === "choose" ? (
				<div className="space-y-3 py-4">
					{previousMonth && previousMonth.categoryCount > 0 && (
						<button
							onClick={() => handleOptionSelect("previous")}
							className={cn(
								"w-full text-left p-4 rounded-lg border-2 transition-all",
								"hover:border-info hover:bg-info/5",
								selectedOption === "previous" ? "border-info bg-info/5" : "border-border"
							)}
						>
							<div className="flex items-start gap-4">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
									<FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
								</div>
								<div className="flex-1">
									<div className="flex items-center justify-between">
										<h4 className="font-semibold text-primary">Import from {previousMonth.name}</h4>
										<ChevronRight className="h-4 w-4 text-primary" />
									</div>
									<p className="text-sm text-primary mt-1">
										Copy all {previousMonth.categoryCount} categories ({formatCurrency(previousMonth.totalBudget)} total
										budget)
									</p>
								</div>
							</div>
						</button>
					)}

					<button
						onClick={() => handleOptionSelect("template")}
						className={cn(
							"w-full text-left p-4 rounded-lg border-2 transition-all",
							"hover:border-info hover:bg-info/5",
							selectedOption === "template" ? "border-info bg-info/5" : "border-border"
						)}
					>
						<div className="flex items-start gap-4">
							<div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
								<FolderOpen className="h-5 w-5 text-purple-600 dark:text-purple-400" />
							</div>
							<div className="flex-1">
								<div className="flex items-center justify-between">
									<h4 className="font-semibold text-primary">Use a Template</h4>
									<ChevronRight className="h-4 w-4 text-primary" />
								</div>
								<p className="text-sm text-primary mt-1">
									{templates.length > 0
										? `Select from your ${templates.length} saved templates`
										: "No templates saved yet"}
								</p>
							</div>
						</div>
					</button>

					{selectedOption === "template" && (
						<div className="ml-8 space-y-2 animate-in fade-in slide-in-from-top-2">
							{templates.length === 0 ? (
								<p className="text-sm text-primary py-4 text-center">
									You don't have any saved templates yet. Create a budget and save it as a template for future use.
								</p>
							) : (
								templates.map((template) => (
									<button
										key={template.id}
										onClick={() => handleTemplateSelect(template.id)}
										className={cn(
											"w-full text-left p-3 rounded-lg border transition-all",
											"hover:border-info hover:bg-info/5",
											selectedTemplateId === template.id ? "border-info bg-info/5" : "border-border"
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
													<Check className="h-4 w-4 text-info" />
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

					<button
						onClick={() => handleOptionSelect("fresh")}
						className={cn(
							"w-full text-left p-4 rounded-lg border-2 transition-all",
							"hover:border-info hover:bg-info/5",
							selectedOption === "fresh" ? "border-info bg-info/5" : "border-border"
						)}
					>
						<div className="flex items-start gap-4">
							<div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
								<Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
							</div>
							<div className="flex-1">
								<div className="flex items-center justify-between">
									<h4 className="font-semibold text-primary">Start Fresh</h4>
									<ChevronRight className="h-4 w-4 text-primary" />
								</div>
								<p className="text-sm text-primary mt-1">Create a new budget from scratch</p>
							</div>
						</div>
					</button>
				</div>
			) : (
				<div className="py-4 space-y-4">
					<div className="space-y-2">
						<Label htmlFor="expectedIncome" className="text-sm font-medium">
							Expected Income for {monthName}
						</Label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">$</span>
							<Input
								id="expectedIncome"
								type="number"
								inputMode="decimal"
								placeholder="0.00"
								value={expectedIncome}
								onChange={(e) => setExpectedIncome(e.target.value)}
								className="pl-7 text-lg font-semibold"
								autoFocus
							/>
						</div>
						<p className="text-xs text-primary">This helps track your budget against your income</p>
					</div>

					<Card className="p-4 bg-muted/50">
						<h5 className="text-sm font-medium text-primary mb-2">Summary</h5>
						<div className="space-y-1 text-sm">
							<div className="flex justify-between">
								<span className="text-primary">Method</span>
								<span className="font-medium text-primary">
									{selectedOption === "previous"
										? `Import from ${previousMonth?.name}`
										: selectedOption === "template"
											? templates.find((t) => t.id === selectedTemplateId)?.name
											: "Start fresh"}
								</span>
							</div>
							{selectedOption !== "fresh" && (
								<div className="flex justify-between">
									<span className="text-primary">Categories</span>
									<span className="font-medium text-primary">
										{selectedOption === "previous"
											? previousMonth?.categoryCount
											: templates.find((t) => t.id === selectedTemplateId)?.categoryCount}
									</span>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-primary">Expected Income</span>
								<span className="font-medium text-primary">
									{expectedIncome ? formatCurrency(parseFloat(expectedIncome)) : "Not set"}
								</span>
							</div>
						</div>
					</Card>

					<div className="flex gap-3 pt-2">
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
