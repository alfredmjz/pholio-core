"use client";

import { useState, useEffect } from "react";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Loader2, Calendar } from "lucide-react";
import { exportTransactions } from "../utils/exportUtils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { MonthPicker } from "@/components/month-picker";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { GoogleSheetsIcon } from "@/components/icons/allocation-icons";

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
	const [isGoogleExporting, setIsGoogleExporting] = useState(false);
	const [activeTab, setActiveTab] = useState("quick");
	const router = useRouter();

	const [startDate, setStartDate] = useState<Date | undefined>(new Date(currentYear, currentMonth - 1, 1));
	const [endDate, setEndDate] = useState<Date | undefined>(new Date(currentYear, currentMonth, 0)); // Last day of month

	const [isGuest, setIsGuest] = useState(false);

	useEffect(() => {
		if (open) {
			const checkGuestStatus = async () => {
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (user) {
					const { data: profile } = await supabase.from("users").select("is_guest").eq("id", user.id).single();

					if (profile?.is_guest) {
						setIsGuest(true);
					} else {
						const pending = localStorage.getItem("pendingGoogleExport");
						if (pending === "true") {
							localStorage.removeItem("pendingGoogleExport");
							toast.info("Registration Complete", {
								description:
									"Your account is upgraded. Please click 'Open in Sheets' again to connect your Google Account and finish the export.",
								duration: 8000,
							});
						}
					}
				}
			};
			checkGuestStatus();
		}
	}, [open]);

	const getRange = () => {
		if (activeTab === ("quick" as string)) {
			return {
				type: "current" as const,
				startYear: currentYear,
				startMonth: currentMonth,
				endYear: currentYear,
				endMonth: currentMonth,
			};
		} else {
			if (!startDate || !endDate) {
				throw new Error("Please select both start and end dates");
			}
			if (endDate < startDate) {
				throw new Error("End date cannot be before start date");
			}

			return {
				type: "custom" as const,
				startYear: startDate.getFullYear(),
				startMonth: startDate.getMonth() + 1,
				endYear: endDate.getFullYear(),
				endMonth: endDate.getMonth() + 1,
			};
		}
	};

	const handleExport = async () => {
		setIsExporting(true);
		try {
			const range = getRange();
			let filename = "";

			const startStr = `${MONTHS[range.startMonth - 1].value < 10 ? "0" : ""}${MONTHS[range.startMonth - 1].value}_${range.startYear}`;
			const endStr = `${MONTHS[range.endMonth - 1].value < 10 ? "0" : ""}${MONTHS[range.endMonth - 1].value}_${range.endYear}`;

			if (activeTab === "quick" || startStr === endStr) {
				filename = `pholio_export_${startStr}`;
			} else {
				filename = `pholio_export_${startStr}_to_${endStr}`;
			}

			await exportTransactions(range, filename);
			toast.success("Export successful");
			onOpenChange(false);
		} catch (error) {
			console.error(error);
			toast.error("Export Failed", {
				description: error instanceof Error ? error.message : "Failed to generate Excel export.",
			});
		} finally {
			setIsExporting(false);
		}
	};

	const handleGoogleExport = async () => {
		setIsGoogleExporting(true);
		try {
			if (isGuest) {
				const confirmed = window.confirm(
					"You need to be registered user with Google Account connected to export to Google Sheets. Proceed to register?"
				);

				if (!confirmed) {
					setIsGoogleExporting(false);
					return;
				}

				// Redirect to signup
				localStorage.setItem("pendingGoogleExport", "true");
				router.push("/signup");
				return;
			}

			const range = getRange();

			const {
				data: { session },
			} = await supabase.auth.getSession();

			const providerToken = session?.provider_token;

			const body: any = {
				token: providerToken,
				startYear: range.startYear,
				startMonth: range.startMonth,
				endYear: range.endYear,
				endMonth: range.endMonth,
			};

			const response = await fetch("/api/google/export", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			const data = await response.json();

			if (!response.ok) {
				if (response.status === 401) {
					toast.info("Connecting to Google...", {
						description: "You will be redirected to approve access.",
						duration: 5000,
					});

					const { error: authError } = await supabase.auth.signInWithOAuth({
						provider: "google",
						options: {
							scopes: "https://www.googleapis.com/auth/spreadsheets",
							queryParams: {
								access_type: "offline",
								prompt: "consent",
							},
						},
					});

					if (authError) {
						console.error("Link/Auth Error:", authError);
						throw authError;
					}

					return;
				}
				throw new Error(data.error || "Failed to create Google Sheet");
			}

			// Success
			if (data.url) {
				window.open(data.url, "_blank");
				toast.success("Spreadsheet created!", { description: "Opened in a new tab." });
				onOpenChange(false);
			}
		} catch (error) {
			console.error(error);
			toast.error("Google Export Failed", {
				description: error instanceof Error ? error.message : "Failed to export data to Google Sheets.",
			});
		} finally {
			setIsGoogleExporting(false);
		}
	};

	const currentMonthName = MONTHS.find((m) => m.value === currentMonth)?.label;

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Export Transactions"
			description="Download your transaction history as an Excel file or open in Google Sheets."
			className="sm:max-w-[625px]"
		>
			<div className="min-h-[300px]">
				<Tabs defaultValue="quick" value={activeTab} onValueChange={setActiveTab} className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="quick">Current Month</TabsTrigger>
						<TabsTrigger value="custom">Custom Range</TabsTrigger>
					</TabsList>

					<TabsContent value="quick" className="space-y-4 py-4">
						<div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/30 min-h-[220px]">
							<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
								<FileText className="h-6 w-6 text-primary" />
							</div>
							<h3 className="font-medium text-lg">
								{currentMonthName} {currentYear}
							</h3>
							<p className="text-sm text-primary text-center mt-1">
								Export all transactions for the currently viewed month.
							</p>
						</div>
					</TabsContent>

					<TabsContent value="custom" className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<div className="text-sm font-medium">Start Month</div>
								<MonthPicker date={startDate} setDate={setStartDate} placeholder="Select start month" />
							</div>

							<div className="space-y-2">
								<div className="text-sm font-medium">End Month</div>
								<MonthPicker date={endDate} setDate={setEndDate} placeholder="Select end month" />
							</div>
						</div>

						<div className="flex items-center justify-center gap-2 px-4 py-2 mt-4 mx-auto w-fit rounded-full bg-blue-50 text-blue-700 text-sm max-w-full">
							<Calendar className="h-4 w-4 shrink-0" />
							<span className="font-medium truncate">
								{startDate ? format(startDate, "MMMM yyyy") : "..."} - {endDate ? format(endDate, "MMMM yyyy") : "..."}
							</span>
						</div>
					</TabsContent>
				</Tabs>
			</div>

			<DialogFooter className="flex-col sm:flex-row gap-2">
				<Button variant="outline" onClick={() => onOpenChange(false)} className="sm:mr-auto">
					Cancel
				</Button>
				<Button
					variant="outline"
					onClick={handleGoogleExport}
					disabled={isGoogleExporting || isExporting}
					className="gap-2"
				>
					{isGoogleExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleSheetsIcon className="h-4 w-4" />}
					Open in Sheets
				</Button>
				<Button onClick={handleExport} disabled={isExporting || isGoogleExporting} className="gap-2">
					{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
					Download
				</Button>
			</DialogFooter>
		</ControlBasedDialog>
	);
}
