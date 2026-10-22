"use client";

import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MinimalTiptap } from "@/components/ui/shadcn-io/minimal-tiptap";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Wallet, Info, PiggyBank, CreditCard } from "lucide-react";
import { createAccount, getAccountTypes } from "../actions";
import type { CreateAccountInput, AccountType, AccountClass, AccountWithType, AccountFieldConfig } from "../types";
import { cn } from "@/lib/utils";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "@/lib/input-utils";
import { sortAccountTypes } from "@/lib/account-utils";
import { FormSection } from "@/components/FormSection";
import { CardSelector } from "@/components/CardSelector";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { Switch } from "@/components/ui/switch";
import { getFieldVisibility } from "../field-visibility";
import { AccountFieldConfigurator } from "./AccountFieldConfigurator";
import { ContributionRoomFields } from "./ContributionRoomFields";
import {
	EMPTY_CONTRIBUTION_ROOM_VALUES,
	toContributionRoomInput,
	toPlanRoomSetting,
	validateContributionRoom,
	type ContributionRoomFormValues,
} from "../contribution-room-form";
import { getContributionRooms, saveContributionRoom } from "@/lib/actions/contribution-actions";
import type { ContributionRoomSetting } from "@/lib/types/contribution";
import { isSampleDataActive } from "@/lib/demo-mode";
import { useDemoStore } from "@/lib/demo-store";

interface AddAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: (account: AccountWithType) => void;
}

interface ValidationErrors {
	name?: string;
	account_type_id?: string;
	current_balance?: string;
	target_balance?: string;
	contribution_room?: string;
}

export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
	interface FormState {
		name: string;
		account_type_id: string;
		current_balance: string;
		target_balance: string;
		original_amount: string;
		interest_rate: string;
		institution: string;
		notes: string;
		payment_due_date: string;
		credit_limit: string;
		loan_term_months: string;
	}

	const [loading, setLoading] = useState(false);
	const [accountType, setAccountType] = useState<AccountClass>("asset");
	const [allAccountTypes, setAllAccountTypes] = useState<AccountType[]>([]);
	const [formData, setFormData] = useState<FormState>({
		name: "",
		account_type_id: "",
		current_balance: "",
		target_balance: "",
		original_amount: "",
		interest_rate: "",
		institution: "",
		notes: "",
		payment_due_date: "",
		credit_limit: "",
		loan_term_months: "",
	});
	const [contribution, setContribution] = useState<ContributionRoomFormValues>(EMPTY_CONTRIBUTION_ROOM_VALUES);
	const [planRooms, setPlanRooms] = useState<ContributionRoomSetting[]>([]);

	// Clear irrelevant fields when category changes
	useEffect(() => {
		if (!formData.account_type_id) return;
		const type = allAccountTypes.find((t) => t.id === formData.account_type_id);
		if (!type) return;
		const vis = getFieldVisibility(type, null);
		setFormData((prev) => ({
			...prev,
			target_balance: vis.showTargetGoal ? prev.target_balance : "",
			original_amount: vis.showOriginalAmount ? prev.original_amount : "",
			credit_limit: vis.showCreditLimit ? prev.credit_limit : "",
			interest_rate: vis.showInterestRate ? prev.interest_rate : "",
			loan_term_months: vis.showLoanTerm ? prev.loan_term_months : "",
			payment_due_date: vis.showDueDate ? prev.payment_due_date : "",
		}));
		if (!vis.showContributionRoom) setContribution(EMPTY_CONTRIBUTION_ROOM_VALUES);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [formData.account_type_id]);
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [openCombobox, setOpenCombobox] = useState(false);
	const [fieldConfig, setFieldConfig] = useState<AccountFieldConfig>({});
	const [searchValue, setSearchValue] = useState("");

	// Fetch account types on mount
	useEffect(() => {
		const fetchTypes = async () => {
			const types = await getAccountTypes();
			setAllAccountTypes(types);
		};
		fetchTypes();
	}, []);

	// Plan rooms are shared across accounts, so reload them each time the dialog opens.
	useEffect(() => {
		if (!open) return;
		getContributionRooms()
			.then(setPlanRooms)
			.catch(() => setPlanRooms([]));
	}, [open]);

	const validateForm = (): boolean => {
		const newErrors: ValidationErrors = {};
		let isValid = true;

		if (!formData.name?.trim()) {
			newErrors.name = "Account name is required";
			isValid = false;
		}

		if (!formData.account_type_id) {
			newErrors.account_type_id = "Category is required";
			isValid = false;
		}

		const contributionError = validateContributionRoom(contribution);
		if (contributionError) {
			newErrors.contribution_room = contributionError;
			isValid = false;
		}

		setErrors(newErrors);

		if (!isValid) {
			toast.error("Please fill in all required fields", {
				description: "Check the form for displayed errors.",
			});
		}

		return isValid;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setLoading(true);

		try {
			const planRoom = toPlanRoomSetting(contribution, planRooms);
			if (planRoom && !(await saveContributionRoom(planRoom))) {
				toast.error("Creation Failed", { description: "Could not save your contribution room. Please try again." });
				return;
			}

			const input: CreateAccountInput = {
				name: formData.name,
				account_type_id: formData.account_type_id,
				// A blank balance means the account starts at zero.
				current_balance: formData.current_balance.trim() ? parseFloat(formData.current_balance) : 0,
				interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) / 100 : null,
				interest_type: formData.interest_rate ? "compound" : null,
				target_balance: formData.target_balance ? parseFloat(formData.target_balance) : null,
				original_amount: formData.original_amount ? parseFloat(formData.original_amount) : null,
				institution: formData.institution || null,
				notes: formData.notes || null,
				payment_due_date: formData.payment_due_date ? parseInt(formData.payment_due_date) : null,
				credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
				loan_term_months: formData.loan_term_months ? parseInt(formData.loan_term_months) : null,
				field_visibility: isOtherType ? fieldConfig : null,
				...toContributionRoomInput(contribution),
			};

			const result = await createAccount(input);

			if (result) {
				// Demo mode: the server returns a mock account without persisting; record it
				// in-memory so it appears for the duration of the session.
				if (isSampleDataActive()) {
					useDemoStore.getState().addAccount(result);
				}
				toast.success("Account created successfully");
				onOpenChange(false);
				onSuccess(result);
				// Reset form
				setFormData({
					name: "",
					account_type_id: "",
					current_balance: "",
					target_balance: "",
					original_amount: "",
					interest_rate: "",
					institution: "",
					notes: "",
					payment_due_date: "",
					credit_limit: "",
					loan_term_months: "",
				});
				setContribution(EMPTY_CONTRIBUTION_ROOM_VALUES);
				setErrors({});
				setSearchValue("");
			} else {
				toast.error("Creation Failed", {
					description: "Failed to create account. Please check your data and try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Creation Error", {
				description: errorMessage,
			});
		} finally {
			setLoading(false);
		}
	};

	const availableTypes = (allAccountTypes || []).filter(
		(t) => t.class === accountType && t.name.toLowerCase().includes(searchValue.toLowerCase())
	);
	const selectedType = (allAccountTypes || []).find((t) => t.id === formData.account_type_id);
	// "Other" accounts get their field set from the configurator below.
	const isOtherType = selectedType?.code === "other";
	const visibility = getFieldVisibility(selectedType, isOtherType ? fieldConfig : null);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-[650px]" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Add New Account</DialogTitle>
					<DialogDescription>Create a new account to track your assets or liabilities.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					{/* Account Type Selection - Card-based */}
					<FormSection icon={<Wallet />} title="What type of account?" variant="subtle">
						<CardSelector
							options={[
								{
									value: "asset" as AccountClass,
									label: "Asset",
									icon: <PiggyBank />,
								},
								{
									value: "liability" as AccountClass,
									label: "Liability",
									icon: <CreditCard />,
								},
							]}
							value={accountType}
							onChange={(val) => {
								setAccountType(val);
								setFormData({
									...formData,
									account_type_id: "",
									current_balance: "",
								});
								setErrors({});
							}}
						/>
					</FormSection>

					{/* Account Details */}
					<FormSection icon={<Info />} title="Account Details" variant="subtle">
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="name">
									Account Name <span className="text-error">*</span>
								</Label>
								<Input
									id="name"
									placeholder="Emergency Fund"
									value={formData.name}
									onChange={(e) => {
										setFormData({ ...formData, name: e.target.value });
										if (errors.name) setErrors({ ...errors, name: undefined });
									}}
									className={cn("h-10", errors.name && "border-error")}
								/>
								{errors.name && <p className="text-sm text-error">{errors.name}</p>}
							</div>

							<div className="space-y-2">
								<Label htmlFor="type-id">
									Category <span className="text-error">*</span>
								</Label>
								<Popover open={openCombobox} onOpenChange={setOpenCombobox}>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={openCombobox}
											className={cn(
												"w-full justify-between h-10",
												!formData.account_type_id && !errors.account_type_id && "text-muted-foreground",
												errors.account_type_id && "border-error"
											)}
										>
											{selectedType ? selectedType.name : "Select category"}
											<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="w-[var(--radix-popover-trigger-width)] p-0"
										onWheel={(e) => e.stopPropagation()}
									>
										<Command shouldFilter={false}>
											<CommandInput
												placeholder="Search account type..."
												value={searchValue}
												onValueChange={setSearchValue}
											/>
											<CommandList>
												<CommandEmpty>No account type found.</CommandEmpty>
												<CommandGroup>
													{sortAccountTypes(availableTypes).map((type) => (
														<CommandItem
															key={type.id}
															value={type.id}
															onSelect={() => {
																setFormData({ ...formData, account_type_id: type.id });
																setErrors({ ...errors, account_type_id: undefined });
																setOpenCombobox(false);
															}}
														>
															<Check
																className={cn(
																	"mr-2 h-4 w-4",
																	formData.account_type_id === type.id ? "opacity-100" : "opacity-0"
																)}
															/>
															{type.name}
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
								{errors.account_type_id && <p className="text-sm text-error">{errors.account_type_id}</p>}
							</div>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="balance">Current Balance</Label>
								<ProminentAmountInput
									id="balance"
									value={formData.current_balance}
									onChange={(val) => {
										setFormData({ ...formData, current_balance: val });
										if (errors.current_balance) setErrors({ ...errors, current_balance: undefined });
									}}
									hasError={!!errors.current_balance}
								/>
								{errors.current_balance && <p className="text-sm text-error">{errors.current_balance}</p>}
							</div>

							{isOtherType && (
								<div className="space-y-2">
									<Label>Fields to track</Label>
									<AccountFieldConfigurator value={fieldConfig} onChange={setFieldConfig} />
								</div>
							)}

							{visibility.showTargetGoal && (
								<div className="space-y-2">
									<Label htmlFor="target">Target Goal</Label>
									<ProminentAmountInput
										id="target"
										value={formData.target_balance}
										onChange={(val) => {
											setFormData({ ...formData, target_balance: val });
											if (errors.target_balance) setErrors({ ...errors, target_balance: undefined });
										}}
										hasError={!!errors.target_balance}
									/>
									{errors.target_balance && <p className="text-sm text-error">{errors.target_balance}</p>}
								</div>
							)}
						</div>

						{/* Credit-specific fields */}
						{visibility.showCreditLimit && (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
								<div className="space-y-2">
									<Label htmlFor="credit_limit">Credit Limit (Optional)</Label>
									<ProminentAmountInput
										id="credit_limit"
										value={formData.credit_limit}
										onChange={(val) => setFormData({ ...formData, credit_limit: val })}
										hasError={false}
									/>
								</div>
								{visibility.showDueDate && (
									<div className="space-y-2">
										<Label htmlFor="payment_due_date">Payment Due Date (1-31)</Label>
										<Input
											id="payment_due_date"
											type="text"
											inputMode="numeric"
											placeholder="e.g., 21"
											value={formData.payment_due_date}
											onChange={(e) =>
												setFormData({ ...formData, payment_due_date: sanitizeIntegerInput(e.target.value) })
											}
											className="h-10"
										/>
									</div>
								)}
							</div>
						)}

						{/* Debt-specific fields: Original Loan Amount & Loan Term */}
						{visibility.showOriginalAmount && (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
								<div className="space-y-2">
									<Label htmlFor="original_amount">Original Loan Amount</Label>
									<ProminentAmountInput
										id="original_amount"
										value={formData.original_amount}
										onChange={(val) => setFormData({ ...formData, original_amount: val })}
										hasError={false}
									/>
								</div>
								{visibility.showLoanTerm && (
									<div className="space-y-2">
										<Label htmlFor="loan_term">Loan Term (Months)</Label>
										<Input
											id="loan_term"
											type="text"
											inputMode="numeric"
											placeholder="e.g., 60"
											value={formData.loan_term_months}
											onChange={(e) =>
												setFormData({ ...formData, loan_term_months: sanitizeIntegerInput(e.target.value) })
											}
											className="h-10"
										/>
									</div>
								)}
							</div>
						)}

						{/* Debt-specific: Due Date & APR row */}
						{visibility.showOriginalAmount && visibility.showDueDate && (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
								<div className="space-y-2">
									<Label htmlFor="payment_due_date">Payment Due Date (1-31)</Label>
									<Input
										id="payment_due_date"
										type="text"
										inputMode="numeric"
										placeholder="e.g., 15"
										value={formData.payment_due_date}
										onChange={(e) =>
											setFormData({ ...formData, payment_due_date: sanitizeIntegerInput(e.target.value) })
										}
										className="h-10"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="interest">{visibility.interestRateLabel}</Label>
									<Input
										id="interest"
										type="text"
										inputMode="decimal"
										placeholder="5.50"
										value={formData.interest_rate}
										onChange={(e) => {
											setFormData({ ...formData, interest_rate: sanitizeDecimalInput(e.target.value, 2) });
										}}
										className="h-10"
									/>
								</div>
							</div>
						)}

						{/* Interest Rate for non-debt categories that show it (credit, banking, etc.) */}
						{visibility.showInterestRate && !visibility.showOriginalAmount && (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
								<div className="space-y-2">
									<Label htmlFor="interest">{visibility.interestRateLabel}</Label>
									<Input
										id="interest"
										type="text"
										inputMode="decimal"
										placeholder={selectedType?.category === "credit" ? "19.99" : "4.00"}
										value={formData.interest_rate}
										onChange={(e) => {
											setFormData({ ...formData, interest_rate: sanitizeDecimalInput(e.target.value, 2) });
										}}
										className="h-10"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="institution">{visibility.institutionLabel}</Label>
									<Input
										id="institution"
										placeholder={visibility.institutionPlaceholder}
										value={formData.institution}
										onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
										className="h-10"
									/>
								</div>
							</div>
						)}

						{/* Institution for debt (shown separately since APR is in a different row) */}
						{visibility.showOriginalAmount && (
							<div className="space-y-2 mt-4">
								<Label htmlFor="institution">{visibility.institutionLabel}</Label>
								<Input
									id="institution"
									placeholder={visibility.institutionPlaceholder}
									value={formData.institution}
									onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
									className="h-10"
								/>
							</div>
						)}

						{/* Contribution Room (Investment/Retirement) */}
						{visibility.showContributionRoom && (
							<>
								<div className="mt-4">
									<ContributionRoomFields
										values={contribution}
										planRooms={planRooms}
										onChange={(changes) => {
											setContribution((prev) => ({ ...prev, ...changes }));
											if (errors.contribution_room) setErrors({ ...errors, contribution_room: undefined });
										}}
										error={errors.contribution_room}
									/>
								</div>

								<div className="space-y-2 mt-4">
									<Label htmlFor="institution">{visibility.institutionLabel}</Label>
									<Input
										id="institution"
										placeholder={visibility.institutionPlaceholder}
										value={formData.institution}
										onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
										className="h-10"
									/>
								</div>
							</>
						)}
					</FormSection>

					{/* Notes - Optional section */}
					<FormSection variant="subtle">
						<div className="space-y-2">
							<Label>Notes</Label>
							<MinimalTiptap
								content={formData.notes}
								onChange={(content) => setFormData({ ...formData, notes: content })}
								placeholder="Additional information about this account..."
							/>
						</div>
					</FormSection>

					<DialogFooter className="pt-6">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
							Cancel
							<CancelShortcut />
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? "Creating..." : "Create Account"}
							<SubmitShortcut />
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
