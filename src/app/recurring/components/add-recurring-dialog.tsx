"use client";

import { useState } from "react";
import { addRecurringExpense, RecurringExpense } from "../actions";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, CircleDollarSign, CreditCard, House } from "lucide-react";
import { toast } from "sonner";
import { ServiceLogo } from "@/components/service-logo";
import { ServiceAutocomplete } from "@/components/service-autocomplete";

interface AddRecurringDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: (expense: RecurringExpense) => void;
}

const PRESET_PROVIDERS = [
	{ id: "netflix", name: "Netflix", domain: "netflix.com", category: "subscription" },
	{ id: "spotify", name: "Spotify", domain: "spotify.com", category: "subscription" },
	{ id: "apple", name: "Apple", domain: "apple.com", category: "subscription" },
	{ id: "amazon", name: "Amazon Prime", domain: "amazon.com", category: "subscription" },
	{ id: "disney", name: "Disney+", domain: "disneyplus.com", category: "subscription" },
	{
		id: "other_subscription",
		name: "Other Subscription",
		domain: null,
		category: "subscription",
		isCustom: true,
		icon: CircleDollarSign,
		color: "bg-amber-500",
	},
	{ id: "rent", name: "Rent", domain: null, category: "bill", isGeneric: true, icon: House, color: "bg-purple-500" },
	{
		id: "bill",
		name: "Bill",
		domain: null,
		category: "bill",
		isGeneric: true,
		icon: CreditCard,
		color: "bg-slate-500",
	},
];

export function AddRecurringDialog({ open, onOpenChange, onSuccess }: AddRecurringDialogProps) {
	const [step, setStep] = useState(1);
	const [formData, setFormData] = useState({
		name: "",
		amount: "",
		billing_period: "monthly",
		next_due_date: new Date(),
		category: "subscription",
		service_provider: "",
		isCustom: false,
		is_automated: true,
		meta_data: {} as Record<string, any>,
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

	const handleProviderSelect = (provider: (typeof PRESET_PROVIDERS)[number]) => {
		const isCustom = provider.isCustom === true;
		const isGeneric = provider.isGeneric === true;

		setFormData({
			...formData,
			name: isCustom ? "" : provider.name,
			category: provider.category,
			service_provider: isCustom || isGeneric ? "" : provider.id,
			isCustom: isCustom,
			// For custom subscriptions, we'll derive service_provider from the name later
			// For generic bills, we don't need logo lookup
			meta_data: isGeneric ? { no_logo_lookup: true } : {},
		});
		setStep(2);
	};

	const handleSubmit = async () => {
		// Validate name
		if (!formData.name.trim()) {
			toast.error("Name is required", {
				description: "Please enter a name for this recurring expense.",
			});
			return;
		}

		// Validate amount
		if (!formData.amount) {
			toast.error("Amount is required", {
				description: "Please enter an amount for this recurring expense.",
			});
			return;
		}

		// Validate amount format (numbers only, max 2 decimal places)
		const amountRegex = /^\d+(\.\d{1,2})?$/;
		if (!amountRegex.test(formData.amount)) {
			toast.error("Invalid amount", {
				description: "Please enter a valid number with up to 2 decimal places (e.g., 9.99).",
			});
			return;
		}

		const amount = parseFloat(formData.amount);
		if (amount <= 0) {
			toast.error("Invalid amount", {
				description: "Amount must be greater than zero.",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			// For custom subscriptions, use the selected domain from autocomplete if available
			// Otherwise fall back to deriving from name
			let serviceProvider = formData.service_provider;
			let metaData = { ...formData.meta_data };

			if (formData.isCustom) {
				if (selectedDomain) {
					// Use the domain from autocomplete (e.g., "atlassian.com" for Jira)
					serviceProvider = selectedDomain.replace(/\.com$|\.io$|\.org$/, "");
					metaData.domain = selectedDomain; // Store for accurate logo lookup
				} else {
					// No autocomplete selection, derive from name
					serviceProvider = formData.name
						.toLowerCase()
						.replace(/\s+/g, "")
						.replace(/[^a-z0-9]/g, "");
				}
			}

			const result = await addRecurringExpense({
				name: formData.name,
				amount: amount,
				billing_period: formData.billing_period,
				next_due_date: format(formData.next_due_date, "yyyy-MM-dd"),
				category: formData.category,
				service_provider: serviceProvider,
				is_active: true,
				currency: "USD",
				meta_data: {
					...metaData,
					is_automated: formData.is_automated,
				},
			});

			if (result) {
				toast.success("Recurring expense added");
				onSuccess?.(result);
				onOpenChange(false);
				// Reset form
				setStep(1);
				setSelectedDomain(null);
				setFormData({
					name: "",
					amount: "",
					billing_period: "monthly",
					next_due_date: new Date(),
					category: "subscription",
					service_provider: "",
					isCustom: false,
					is_automated: true,
					meta_data: {},
				});
			} else {
				toast.error("Save Failed", {
					description: "Failed to add expense. Please check your data and try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while saving.";
			toast.error("Error", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<ControlBasedDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Add Recurring Expense"
			description={step === 1 ? "Select a service provider or create custom." : "Enter expense details."}
			className="sm:max-w-[500px]"
		>
			{step === 1 && (
				<div className="grid grid-cols-2 gap-4 py-4">
					{PRESET_PROVIDERS.map((provider) => (
						<div
							key={provider.id}
							className="flex flex-col items-center justify-center p-4 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors gap-2"
							onClick={() => handleProviderSelect(provider)}
						>
							<div
								className={cn(
									"h-10 w-10 rounded-full flex items-center justify-center overflow-hidden",
									provider.color || "bg-muted"
								)}
							>
								{provider.isCustom || provider.isGeneric ? (
									<provider.icon className="h-6 w-6" />
								) : (
									<ServiceLogo
										name={provider.name}
										serviceProvider={provider.id}
										domain={provider.domain ?? undefined}
										width={40}
										height={40}
										className="rounded-full"
									/>
								)}
							</div>
							<span className="font-medium text-sm">{provider.name}</span>
						</div>
					))}
				</div>
			)}

			{step === 2 && (
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label>
							Name <span className="text-error">*</span>
						</Label>
						{formData.isCustom ? (
							<ServiceAutocomplete
								value={formData.name}
								onChange={(name, domain) => {
									setFormData({ ...formData, name });
									if (domain) {
										setSelectedDomain(domain);
									}
								}}
								placeholder="Search services (e.g., Jira, Notion, Figma)"
							/>
						) : (
							<Input
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								placeholder="Netflix, Rent, etc."
							/>
						)}
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>
								Amount <span className="text-error">*</span>
							</Label>
							<Input
								type="text"
								inputMode="decimal"
								startAdornment="$"
								value={formData.amount}
								onChange={(e) => {
									const value = e.target.value;
									if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
										setFormData({ ...formData, amount: value });
									}
								}}
								placeholder="0.00"
							/>
						</div>
						<div className="space-y-2">
							<Label>Frequency</Label>
							<Select
								value={formData.billing_period}
								onValueChange={(v) => setFormData({ ...formData, billing_period: v })}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="monthly">Monthly</SelectItem>
									<SelectItem value="yearly">Annually</SelectItem>
									<SelectItem value="weekly">Weekly</SelectItem>
									<SelectItem value="biweekly">Bi-weekly</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="space-y-2">
						<Label>First Due Date</Label>
						<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
							<PopoverTrigger asChild>
								<Button
									variant={"outline"}
									className={cn(
										"w-full justify-start text-left font-normal",
										!formData.next_due_date && "text-primary"
									)}
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{formData.next_due_date ? format(formData.next_due_date, "PPP") : <span>Pick a date</span>}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0">
								<Calendar
									mode="single"
									selected={formData.next_due_date}
									onSelect={(date) => {
										if (date) {
											setFormData({ ...formData, next_due_date: date });
											setIsCalendarOpen(false);
										}
									}}
									autoFocus
								/>
							</PopoverContent>
						</Popover>
					</div>
					{formData.category === "bill" && (
						<div className="flex items-center justify-between space-x-2 pt-2">
							<div className="flex flex-col gap-1">
								<Label htmlFor="auto-pay" className="leading-none">
									Auto-pay
								</Label>
								<span className="text-xs text-muted-foreground">Automatically create transactions</span>
							</div>
							<Switch
								id="auto-pay"
								checked={formData.is_automated}
								onCheckedChange={(checked) => setFormData({ ...formData, is_automated: checked })}
							/>
						</div>
					)}
				</div>
			)}

			<DialogFooter>
				{step === 2 && (
					<Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
						Back
					</Button>
				)}
				{step === 2 && (
					<Button onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting ? "Adding..." : "Add Expense"}
					</Button>
				)}
			</DialogFooter>
		</ControlBasedDialog>
	);
}
