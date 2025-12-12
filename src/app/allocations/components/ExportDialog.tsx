"use client";

import { useState, useEffect } from "react";
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
import { FileText, Download, Loader2, Calendar } from "lucide-react";
import { exportTransactions } from "../utils/exportUtils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { MonthPicker } from "@/components/month-picker";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import Image from "next/image";
import googleIcon from "@/public/gsheets-icon48x48.svg";

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

	// Custom range state
	const [startDate, setStartDate] = useState<Date | undefined>(new Date(currentYear, currentMonth - 1, 1));
	const [endDate, setEndDate] = useState<Date | undefined>(new Date(currentYear, currentMonth, 0)); // Last day of month

	const [isGuest, setIsGuest] = useState(false);

	// Check if user is guest on mount/open
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
						// Check if we came back from registration for this purpose
						// This logic runs if the user is registered (not guest)
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
			// Extract Year/Month from the Date objects (MonthPicker returns 1st of month)
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

			// Format filename nicely for months
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
			toast.error(error instanceof Error ? error.message : "Export failed");
		} finally {
			setIsExporting(false);
		}
	};

	const handleGoogleExport = async () => {
		setIsGoogleExporting(true);
		try {
			// GUEST CHECK: Gate feature for guests
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

			// Check for Google connection first
			const {
				data: { session },
			} = await supabase.auth.getSession();

			// Pass the provider token explicitly in the body if available
			// This works around server-side cookie persistence issues for tokens
			const providerToken = session?.provider_token;

			// Send Year/Month params to API
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
				// Relaxed check: any 401 triggers auth flow
				if (response.status === 401) {
					toast.info("Connecting to Google...", {
						description: "You will be redirected to approve access.",
						duration: 5000,
					});

					// Use signInWithOAuth due to manual linking restrictions
					const { error: authError } = await supabase.auth.signInWithOAuth({
						provider: "google",
						options: {
							redirectTo: window.location.href, // Return here
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
					// The user will be redirected, so we can stop here.
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
			toast.error(error instanceof Error ? error.message : "Google Export failed");
		} finally {
			setIsGoogleExporting(false);
		}
	};

	const currentMonthName = MONTHS.find((m) => m.value === currentMonth)?.label;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[625px]">
				<DialogHeader>
					<DialogTitle>Export Transactions</DialogTitle>
					<DialogDescription>
						Download your transaction history as an Excel file or open in Google Sheets.
					</DialogDescription>
				</DialogHeader>

				{/* Min height container to prevent jumping */}
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
								<p className="text-sm text-muted-foreground text-center mt-1">
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
									{startDate ? format(startDate, "MMMM yyyy") : "..."} -{" "}
									{endDate ? format(endDate, "MMMM yyyy") : "..."}
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
						{isGoogleExporting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Image src={googleIcon} alt="Google Sheets" width={16} height={16} className="h-4 w-4" />
						)}
						Open in Sheets
					</Button>
					<Button onClick={handleExport} disabled={isExporting || isGoogleExporting} className="gap-2">
						{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
						Download
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
