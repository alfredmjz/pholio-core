"use client";

import { useState } from "react";
import { addRecurringExpense, RecurringExpense } from "../actions";
import { ControlBasedDialog } from "@/components/dialogWrapper";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatDateString, parseLocalDate } from "@/lib/date-utils";
import { CircleDollarSign, CreditCard, House } from "lucide-react";
import { toast } from "sonner";
import { ServiceLogo } from "@/components/service-logo";
import { ServiceAutocomplete } from "@/components/service-autocomplete";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { sanitizePositiveIntegerInput } from "@/lib/input-utils";
import type { AccountWithType } from "@/app/accounts/types";
import { NO_ACCOUNT, RecurringAccountField } from "./recurring-account-field";

interface AddRecurringDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: (expense: RecurringExpense) => void;
	/** Allocation category names to choose from; empty falls back to Subscriptions/Bills. */
	categoryOptions?: string[];
	accounts?: AccountWithType[];
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
		color: "bg-warning-muted text-warning",
	},
	{
		id: "rent",
		name: "Rent",
		domain: null,
		category: "bill",
		isGeneric: true,
		icon: House,
		color: "bg-error-muted text-error",
	},
	{
		id: "bill",
		name: "Bill",
		domain: null,
		category: "bill",
		isGeneric: true,
		icon: CreditCard,
		color: "bg-accent-muted text-accent",
	},
];

export function AddRecurringDialog({
	open,
	onOpenChange,
	onSuccess,
	categoryOptions = [],
	accounts = [],
}: AddRecurringDialogProps) {
	const [step, setStep] = useState(1);
	const [formData, setFormData] = useState({
		name: "",
		amount: "",
		frequency_value: "1",
		frequency_unit: "months",
		next_due_date: new Date(),
		category: "subscription",
		budget_category: "__default__",
		account_id: NO_ACCOUNT,
		service_provider: "",
		isCustom: false,
		is_automated: true,
		meta_data: {} as Record<string, any>,
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

	const handleProviderSelect = (provider: (typeof PRESET_PROVIDERS)[number]) => {
		const isCustom = provider.isCustom === true;
		const isGeneric = provider.isGeneric === true;

		setFormData({
			...formData,
			name: isCustom ? "" : provider.name,
			category: provider.category,
			service_provider: isCustom || isGeneric ? "" : provider.id,
			isCustom: isCustom,
			meta_data: isGeneric ? { no_logo_lookup: true } : {},
		});
		setStep(2);
	};

	const handleSubmit = async () => {
		if (!formData.name.trim()) {
			toast.error("Name is required", {
				description: "Please enter a name for this recurring expense.",
			});
			return;
		}

		if (!formData.amount) {
			toast.error("Amount is required", {
				description: "Please enter an amount for this recurring expense.",
			});
			return;
		}

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

		// The field may be empty while typing; it only has to be a whole number of at least 1 on submit.
		const frequencyValue = parseInt(formData.frequency_value, 10);
		if (!(frequencyValue >= 1)) {
			toast.error("Invalid frequency", {
				description: "Frequency must be a whole number of at least 1.",
			});
			return;
		}

		setIsSubmitting(true);
		try {
			let serviceProvider = formData.service_provider;
			let metaData = { ...formData.meta_data };

			if (formData.isCustom) {
				if (selectedDomain) {
					serviceProvider = selectedDomain.replace(/\.com$|\.io$|\.org$/, "");
					metaData.domain = selectedDomain;
				} else {
					serviceProvider = formData.name
						.toLowerCase()
						.replace(/\s+/g, "")
						.replace(/[^a-z0-9]/g, "");
				}
			}

			const result = await addRecurringExpense({
				name: formData.name,
				amount: amount,
				billing_period: `${frequencyValue}:${formData.frequency_unit}`,
				next_due_date: formatDateString(formData.next_due_date),
				category: formData.category,
				budget_category: formData.budget_category === "__default__" ? null : formData.budget_category,
				account_id: formData.account_id === NO_ACCOUNT ? null : formData.account_id,
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

				setStep(1);
				setSelectedDomain(null);
				setFormData({
					name: "",
					amount: "",
					frequency_value: "1",
					frequency_unit: "months",
					next_due_date: new Date(),
					category: "subscription",
					budget_category: "__default__",
					account_id: NO_ACCOUNT,
					service_provider: "",
					isCustom: false,
					is_automated: true,
					meta_data: {},
				});
			} else {
				toast.error("Couldn't save the recurring item", {
					description: "Failed to add expense. Please check your data and try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred while saving.";
			toast.error("Something went wrong", {
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
			onEnterSubmit={step === 2 ? handleSubmit : undefined}
			onEscapeKeyDown={(event) => {
				if (step === 2) {
					event.preventDefault();
					setStep(1);
				}
			}}
		>
			{step === 1 && (
				<div className="grid grid-cols-2 gap-3 py-4 sm:gap-4">
					{PRESET_PROVIDERS.map((provider) => (
						<button
							type="button"
							key={provider.id}
							className="card-interactive flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 p-4"
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
							<span className="type-body-sm font-medium text-primary">{provider.name}</span>
						</button>
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
								className="h-10"
							/>
						)}
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label>
								Amount <span className="text-error">*</span>
							</Label>
							<ProminentAmountInput
								value={formData.amount}
								onChange={(val) => setFormData({ ...formData, amount: val })}
								hasError={false}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="frequency-value">Frequency</Label>
							<div className="flex gap-2">
								<Input
									type="text"
									id="frequency-value"
									inputMode="numeric"
									value={formData.frequency_value}
									onChange={(e) => {
										const val = sanitizePositiveIntegerInput(e.target.value);
										setFormData({ ...formData, frequency_value: val });
									}}
									className="h-10 w-20"
								/>
								<Select
									value={formData.frequency_unit}
									onValueChange={(v) => setFormData({ ...formData, frequency_unit: v })}
								>
									<SelectTrigger className="h-10 flex-1">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="days">Days</SelectItem>
										<SelectItem value="weeks">Weeks</SelectItem>
										<SelectItem value="months">Months</SelectItem>
										<SelectItem value="years">Years</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="next-due-date">First Due Date</Label>
						<DatePicker
							id="next-due-date"
							value={formatDateString(formData.next_due_date)}
							onChange={(date) => setFormData({ ...formData, next_due_date: parseLocalDate(date) })}
							yearPicker
						/>
					</div>
					<div className="space-y-2">
						<Label>Budget category</Label>
						<Select
							value={formData.budget_category}
							onValueChange={(v) => setFormData({ ...formData, budget_category: v })}
						>
							<SelectTrigger className="h-10">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__default__">
									Default ({formData.category === "bill" ? "Bills" : "Subscriptions"})
								</SelectItem>
								{categoryOptions.map((name) => (
									<SelectItem key={name} value={name}>
										{name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">Which budget category this recurring expense is added to.</p>
					</div>
					<RecurringAccountField
						id="recurring-account"
						value={formData.account_id}
						onChange={(v) => setFormData({ ...formData, account_id: v })}
						accounts={accounts}
					/>
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
						<CancelShortcut />
					</Button>
				)}
				{step === 2 && (
					<Button onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting ? "Adding..." : "Add Expense"}
						<SubmitShortcut />
					</Button>
				)}
			</DialogFooter>
		</ControlBasedDialog>
	);
}
