"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { FileText, FolderOpen, Sparkles, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateImportDialogProps {
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
		categoryCount: number;
		totalBudget: number;
	}>;
	onImportPrevious: (expectedIncome: number) => void;
	onUseTemplate: (templateId: string, expectedIncome: number) => void;
	onStartFresh: (expectedIncome: number) => void;
}

type ImportOption = "previous" | "template" | "fresh";

export function TemplateImportDialog({
	open,
	onOpenChange,
	monthName,
	year,
	previousMonth,
	templates = [],
	onImportPrevious,
	onUseTemplate,
	onStartFresh,
}: TemplateImportDialogProps) {
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

		// Reset state
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="text-xl">
						Set Up {monthName} {year}
					</DialogTitle>
					<DialogDescription>
						{step === "choose"
							? "This month doesn't have a budget yet. How would you like to get started?"
							: "Set your expected income for this month"}
					</DialogDescription>
				</DialogHeader>

				{step === "choose" ? (
					<div className="space-y-3 py-4">
						{/* Import from Previous Month */}
						{previousMonth && (
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
											<h4 className="font-semibold text-foreground">Import from {previousMonth.name}</h4>
											<ChevronRight className="h-4 w-4 text-muted-foreground" />
										</div>
										<p className="text-sm text-muted-foreground mt-1">
											Copy all {previousMonth.categoryCount} categories ({formatCurrency(previousMonth.totalBudget)}{" "}
											total budget)
										</p>
									</div>
								</div>
							</button>
						)}

						{/* Use a Template */}
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
										<h4 className="font-semibold text-foreground">Use a Template</h4>
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									</div>
									<p className="text-sm text-muted-foreground mt-1">
										{templates.length > 0
											? `Select from your ${templates.length} saved templates`
											: "No templates saved yet"}
									</p>
								</div>
							</div>
						</button>

						{/* Template Selection (shown when template option selected) */}
						{selectedOption === "template" && (
							<div className="ml-8 space-y-2 animate-in fade-in slide-in-from-top-2">
								{templates.length === 0 ? (
									<p className="text-sm text-muted-foreground py-4 text-center">
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
											<div className="flex items-center justify-between">
												<div>
													<h5 className="font-medium text-foreground">{template.name}</h5>
													<p className="text-xs text-muted-foreground">
														{template.categoryCount} categories &middot; {formatCurrency(template.totalBudget)}
													</p>
												</div>
												{selectedTemplateId === template.id && <Check className="h-4 w-4 text-info" />}
											</div>
										</button>
									))
								)}
							</div>
						)}

						{/* Start Fresh */}
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
										<h4 className="font-semibold text-foreground">Start Fresh</h4>
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									</div>
									<p className="text-sm text-muted-foreground mt-1">Create a new budget from scratch</p>
								</div>
							</div>
						</button>
					</div>
				) : (
					<div className="py-4 space-y-4">
						{/* Income Input */}
						<div className="space-y-2">
							<Label htmlFor="expectedIncome" className="text-sm font-medium">
								Expected Income for {monthName}
							</Label>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
								<Input
									id="expectedIncome"
									type="number"
									placeholder="0.00"
									value={expectedIncome}
									onChange={(e) => setExpectedIncome(e.target.value)}
									className="pl-7 text-lg font-semibold"
									autoFocus
								/>
							</div>
							<p className="text-xs text-muted-foreground">This helps track your budget against your income</p>
						</div>

						{/* Summary Card */}
						<Card className="p-4 bg-muted/50">
							<h5 className="text-sm font-medium text-foreground mb-2">Summary</h5>
							<div className="space-y-1 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Method</span>
									<span className="font-medium text-foreground">
										{selectedOption === "previous"
											? `Import from ${previousMonth?.name}`
											: selectedOption === "template"
												? templates.find((t) => t.id === selectedTemplateId)?.name
												: "Start fresh"}
									</span>
								</div>
								{selectedOption !== "fresh" && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Categories</span>
										<span className="font-medium text-foreground">
											{selectedOption === "previous"
												? previousMonth?.categoryCount
												: templates.find((t) => t.id === selectedTemplateId)?.categoryCount}
										</span>
									</div>
								)}
								<div className="flex justify-between">
									<span className="text-muted-foreground">Expected Income</span>
									<span className="font-medium text-foreground">
										{expectedIncome ? formatCurrency(parseFloat(expectedIncome)) : "Not set"}
									</span>
								</div>
							</div>
						</Card>

						{/* Actions */}
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
			</DialogContent>
		</Dialog>
	);
}
