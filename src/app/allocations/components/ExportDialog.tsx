"use client";

import { useState } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger, UNDERLINE_TAB_CLASS } from "@/components/ui/tabs";
import { FileText, Download, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { MonthPicker } from "@/components/month-picker";
import { formatMonthYear } from "@/lib/date-utils";
import { exportTransactions } from "../actions";
import { downloadExcel } from "../utils/exportUtils";

interface ExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentYear: number;
	currentMonth: number;
}

export function ExportDialog({ open, onOpenChange, currentYear, currentMonth }: ExportDialogProps) {
	const [isExporting, setIsExporting] = useState(false);
	const [activeTab, setActiveTab] = useState("quick");

	const [startDate, setStartDate] = useState<Date | undefined>(new Date(currentYear, currentMonth - 1, 1));
	const [endDate, setEndDate] = useState<Date | undefined>(new Date(currentYear, currentMonth, 0)); // Last day of month

	const getRange = () => {
		if (activeTab === "quick") {
			return { startYear: currentYear, startMonth: currentMonth, endYear: currentYear, endMonth: currentMonth };
		}
		if (!startDate || !endDate) throw new Error("Pick a start and an end month.");
		return {
			startYear: startDate.getFullYear(),
			startMonth: startDate.getMonth() + 1,
			endYear: endDate.getFullYear(),
			endMonth: endDate.getMonth() + 1,
		};
	};

	const handleExport = async () => {
		setIsExporting(true);
		try {
			const result = await exportTransactions(getRange());
			if (!result.ok) {
				toast.error("Could not export", { description: result.error.message });
				return;
			}
			await downloadExcel(result.data.headers, result.data.rows, result.data.filename);
			toast.success("Export downloaded");
			onOpenChange(false);
		} catch (error) {
			toast.error("Could not export", {
				description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
			});
		} finally {
			setIsExporting(false);
		}
	};

	const currentMonthName = new Date(currentYear, currentMonth - 1, 1).toLocaleDateString("en-US", { month: "long" });

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Export transactions"
			description="Download them as an Excel file."
			className="sm:max-w-[560px]"
		>
			<div>
				<Tabs defaultValue="quick" value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="flex h-auto w-full justify-start gap-6 rounded-none border-b border-border/70 bg-transparent p-0">
						<TabsTrigger value="quick" className={UNDERLINE_TAB_CLASS}>
							This month
						</TabsTrigger>
						<TabsTrigger value="custom" className={UNDERLINE_TAB_CLASS}>
							Range of months
						</TabsTrigger>
					</TabsList>

					<TabsContent value="quick" className="space-y-4 py-4">
						<div className="flex items-center gap-4 rounded-2xl bg-card-muted/50 p-4">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-primary">
								<FileText className="h-5 w-5" />
							</div>
							<div>
								<h3 className="type-body font-medium text-primary">
									{currentMonthName} {currentYear}
								</h3>
								<p className="type-body-sm text-muted-foreground">
									Every transaction in the month you&apos;re viewing.
								</p>
							</div>
						</div>
					</TabsContent>

					<TabsContent value="custom" className="space-y-4 py-4">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<div className="type-label text-primary">From</div>
								<MonthPicker date={startDate} setDate={setStartDate} placeholder="Select start month" />
							</div>

							<div className="space-y-2">
								<div className="type-label text-primary">To</div>
								<MonthPicker date={endDate} setDate={setEndDate} placeholder="Select end month" />
							</div>
						</div>

						<div className="type-body-sm mt-2 flex w-fit max-w-full items-center gap-2 rounded-full bg-card-muted/60 px-3.5 py-1.5 text-text-secondary">
							<Calendar className="h-4 w-4 shrink-0" />
							<span className="font-medium truncate">
								{startDate ? formatMonthYear(startDate) : "Pick a start"} to{" "}
								{endDate ? formatMonthYear(endDate) : "an end"}
							</span>
						</div>
					</TabsContent>
				</Tabs>
			</div>

			<DialogFooter>
				<Button variant="outline" onClick={() => onOpenChange(false)} className="sm:mr-auto">
					Cancel
				</Button>
				<Button onClick={handleExport} disabled={isExporting} className="gap-2">
					{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
					Download
				</Button>
			</DialogFooter>
		</ControlBasedDialog>
	);
}
