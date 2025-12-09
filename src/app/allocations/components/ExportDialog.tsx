"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, FileText, Calendar, Loader2 } from "lucide-react";
import { exportTransactions } from "../utils/exportUtils";
import { toast } from "sonner";

interface ExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentYear: number;
	currentMonth: number;
}

const MONTHS = [
	{ value: 1, label: "January" },
	{ value: 2, label: "February" },
	{ value: 3, label: "March" },
	{ value: 4, label: "April" },
	{ value: 5, label: "May" },
	{ value: 6, label: "June" },
	{ value: 7, label: "July" },
	{ value: 8, label: "August" },
	{ value: 9, label: "September" },
	{ value: 10, label: "October" },
	{ value: 11, label: "November" },
	{ value: 12, label: "December" },
];

export function ExportDialog({ open, onOpenChange, currentYear, currentMonth }: ExportDialogProps) {
	const [isExporting, setIsExporting] = useState(false);
	const [activeTab, setActiveTab] = useState("quick");

	// Custom range state
	const [startYear, setStartYear] = useState(currentYear.toString());
	const [startMonth, setStartMonth] = useState(currentMonth.toString());
	const [endYear, setEndYear] = useState(currentYear.toString());
	const [endMonth, setEndMonth] = useState(currentMonth.toString());

	// Generate year options (last 5 years + next year)
	const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i);

	const handleExport = async () => {
		setIsExporting(true);
		try {
			if (activeTab === "quick") {
				await exportTransactions(
					{
						type: "current",
						startYear: currentYear,
						startMonth: currentMonth,
						endYear: currentYear,
						endMonth: currentMonth,
					},
					`pholio_export_${currentYear}_${currentMonth}`
				);
				toast.success("Export successful");
			} else {
				// Validate range
				const start = new Date(parseInt(startYear), parseInt(startMonth) - 1);
				const end = new Date(parseInt(endYear), parseInt(endMonth) - 1);

				if (end < start) {
					toast.error("End date cannot be before start date");
					setIsExporting(false);
					return;
				}

				await exportTransactions(
					{
						type: "custom",
						startYear: parseInt(startYear),
						startMonth: parseInt(startMonth),
						endYear: parseInt(endYear),
						endMonth: parseInt(endMonth),
					},
					`pholio_custom_export`
				);
				toast.success("Export successful");
			}
			onOpenChange(false);
		} catch (error) {
			console.error(error);
			toast.error(error instanceof Error ? error.message : "Export failed");
		} finally {
			setIsExporting(false);
		}
	};

	const currentMonthName = MONTHS.find((m) => m.value === currentMonth)?.label;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[450px]">
				<DialogHeader>
					<DialogTitle>Export Transactions</DialogTitle>
					<DialogDescription>Download your transaction history as an Excel file.</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="quick" value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="quick">Current Month</TabsTrigger>
						<TabsTrigger value="custom">Custom Range</TabsTrigger>
					</TabsList>

					<TabsContent value="quick" className="space-y-4 py-4">
						<div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/30">
							<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
								<FileText className="h-6 w-6 text-primary" />
							</div>
							<h3 className="font-medium text-lg">
								{currentMonthName} {currentYear}
							</h3>
							<p className="text-sm text-muted-foreground text-center mt-1">
								Export all transactions for the currently viewed month.
							</p>
						</div>
					</TabsContent>

					<TabsContent value="custom" className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Start Date</Label>
								<div className="grid grid-cols-2 gap-2">
									<Select value={startMonth} onValueChange={setStartMonth}>
										<SelectTrigger>
											<SelectValue placeholder="Month" />
										</SelectTrigger>
										<SelectContent>
											{MONTHS.map((month) => (
												<SelectItem key={month.value} value={month.value.toString()}>
													{month.label.substring(0, 3)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select value={startYear} onValueChange={setStartYear}>
										<SelectTrigger>
											<SelectValue placeholder="Year" />
										</SelectTrigger>
										<SelectContent>
											{years.map((year) => (
												<SelectItem key={year} value={year.toString()}>
													{year}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="space-y-2">
								<Label>End Date</Label>
								<div className="grid grid-cols-2 gap-2">
									<Select value={endMonth} onValueChange={setEndMonth}>
										<SelectTrigger>
											<SelectValue placeholder="Month" />
										</SelectTrigger>
										<SelectContent>
											{MONTHS.map((month) => (
												<SelectItem key={month.value} value={month.value.toString()}>
													{month.label.substring(0, 3)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select value={endYear} onValueChange={setEndYear}>
										<SelectTrigger>
											<SelectValue placeholder="Year" />
										</SelectTrigger>
										<SelectContent>
											{years.map((year) => (
												<SelectItem key={year} value={year.toString()}>
													{year}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>

						<div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 text-blue-800 text-sm">
							<Calendar className="h-4 w-4" />
							<span>
								Selected: {MONTHS.find((m) => m.value.toString() === startMonth)?.label} {startYear} -{" "}
								{MONTHS.find((m) => m.value.toString() === endMonth)?.label} {endYear}
							</span>
						</div>
					</TabsContent>
				</Tabs>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleExport} disabled={isExporting} className="gap-2">
						{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
						{activeTab === "quick" ? "Export Month" : "Export Range"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
