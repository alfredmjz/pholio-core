"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CancelShortcut, SubmitShortcut } from "@/components/common/dialog-shortcuts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScratchPad } from "@/components/common/scratch-pad";
import { isNotesEmpty, notesToHtml } from "@/lib/notes";
import { isInvestmentAccount } from "@/lib/account-validation-utils";
import { INVESTMENT_BALANCE_HINT, INVESTMENT_BALANCE_LABEL } from "@/lib/investment-balance";
import { cn } from "@/lib/utils";
import { getAccountTypes, updateAccount } from "../../actions";
import { isSampleDataActive } from "@/lib/demo-mode";
import type { AccountType, AccountWithType, AccountFieldConfig, UpdateAccountInput } from "../../types";
import { applyTypeChange, describeTypeChange, getTypeChangeOptions, toFieldConfig } from "../../account-type-change";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "@/lib/input-utils";
import { getFieldVisibility } from "../../field-visibility";
import { AccountFieldConfigurator } from "../../components/AccountFieldConfigurator";
import { ContributionRoomFields } from "../../components/ContributionRoomFields";
import { FeeTermsFields } from "../../components/FeeTermsFields";
import { toFeeTermsInput, toFeeTermsValues, type FeeTermsFormValues } from "../../fee-terms-form";
import {
	toContributionRoomInput,
	toPlanRoomSetting,
	validateContributionRoom,
	withPlanRoom,
	type ContributionRoomFormValues,
} from "../../contribution-room-form";
import { getContributionRooms, saveContributionRoom } from "@/lib/actions/contribution-actions";
import { isRegisteredPlan } from "@/lib/contribution-plans";
import { percentInputToRate, rateToPercentInput } from "@/lib/interest-rate";
import type { ContributionRoomSetting } from "@/lib/types/contribution";

interface EditAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	account: AccountWithType;
	onSuccess: (account: AccountWithType) => void;
}

interface ValidationErrors {
	name?: string;
	current_balance?: string;
	target_balance?: string;
	interest_rate?: string;
	contribution_room?: string;
}

export function EditAccountDialog({ open, onOpenChange, account, onSuccess }: EditAccountDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [fieldConfig, setFieldConfig] = useState<AccountFieldConfig>(account.field_visibility ?? {});
	const [formData, setFormData] = useState({
		name: account.name,
		institution: account.institution || "",
		current_balance: account.current_balance.toString(),
		target_balance: account.target_balance?.toString() || "",
		original_amount: account.original_amount?.toString() || "",
		interest_rate: rateToPercentInput(account.interest_rate),
		notes: notesToHtml(account.notes),
		payment_due_date: account.payment_due_date?.toString() || "",
		statement_day: account.statement_day?.toString() || "",
		credit_limit: account.credit_limit?.toString() || "",
		loan_term_months: account.loan_term_months?.toString() || "",
	});
	const [contribution, setContribution] = useState<ContributionRoomFormValues>({
		track_contribution_room: account.track_contribution_room || false,
		contribution_plan: account.contribution_plan ?? "",
		contribution_room: account.contribution_room?.toString() || "",
		contribution_room_as_of: account.contribution_room_as_of ?? "",
		annual_contribution_limit: account.annual_contribution_limit?.toString() || "",
	});
	const [planRooms, setPlanRooms] = useState<ContributionRoomSetting[]>([]);
	const [feeTerms, setFeeTerms] = useState<FeeTermsFormValues>(() => toFeeTermsValues(account));
	const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
	const [typeId, setTypeId] = useState(account.account_type_id);

	// Registered plans keep their room in the shared plan room: load it when the dialog opens
	// and show it in place of the (empty) account columns.
	useEffect(() => {
		if (!open) return;
		setTypeId(account.account_type_id);
		getAccountTypes()
			.then(setAccountTypes)
			.catch(() => setAccountTypes([]));
		getContributionRooms()
			.then((rooms) => {
				setPlanRooms(rooms);
				setContribution((prev) => (isRegisteredPlan(prev.contribution_plan) ? withPlanRoom(prev, rooms) : prev));
			})
			.catch(() => setPlanRooms([]));
	}, [open]);

	// A legacy type is retired, so it is not in the loaded list; keep it as the current choice.
	const typeOptions = getTypeChangeOptions(
		[account.account_type, ...accountTypes.filter((type) => type.id !== account.account_type.id)],
		account.account_type
	);
	const selectedType = typeOptions.find((type) => type.id === typeId) ?? account.account_type;
	const typeChanged = selectedType.id !== account.account_type.id;

	// "Other" accounts allow the owner to choose which fields are tracked.
	const isOtherType = selectedType.code === "other";
	const isInvestment = isInvestmentAccount({ account_type: selectedType });
	const visibility = getFieldVisibility(selectedType, isOtherType ? fieldConfig : null);
	const typeChangeNotes = describeTypeChange(account, account.account_type, selectedType, visibility);

	const pickType = (id: string) => {
		const type = typeOptions.find((option) => option.id === id);
		if (!type) return;
		setTypeId(id);
		// Moving to "Other" starts from the fields the account already shows.
		if (type.code === "other" && !Object.values(fieldConfig).some(Boolean)) {
			setFieldConfig(toFieldConfig(getFieldVisibility(account.account_type, account.field_visibility)));
		}
	};

	const validateForm = (): boolean => {
		const newErrors: ValidationErrors = {};

		// Validate Account Name
		if (!formData.name.trim()) {
			newErrors.name = "Account name is required";
		}

		// Validate Current Balance (blank is saved as 0)
		if (formData.current_balance.trim() && isNaN(parseFloat(formData.current_balance))) {
			newErrors.current_balance = "Please enter a valid number";
		}

		// Validate Target Goal (optional, but must be a valid number if provided)
		if (visibility.showTargetGoal && formData.target_balance.trim() && isNaN(parseFloat(formData.target_balance))) {
			newErrors.target_balance = "Please enter a valid number";
		}

		// Validate Interest Rate (optional, but must be a valid number if provided)
		if (formData.interest_rate.trim() && isNaN(parseFloat(formData.interest_rate))) {
			newErrors.interest_rate = "Please enter a valid number";
		}

		if (visibility.showContributionRoom) {
			const contributionError = validateContributionRoom(contribution);
			if (contributionError) newErrors.contribution_room = contributionError;
		}

		setErrors(newErrors);

		if (Object.keys(newErrors).length > 0) {
			toast.error("Fill in the required fields", {
				description: "Check the form for displayed errors.",
			});
			return false;
		}
		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setIsSubmitting(true);

		try {
			const planRoom = visibility.showContributionRoom ? toPlanRoomSetting(contribution, planRooms) : null;
			if (planRoom && !(await saveContributionRoom(planRoom))) {
				toast.error("Couldn't save your changes", {
					description: "Could not save your contribution room. Please try again.",
				});
				return;
			}

			const fields: UpdateAccountInput = {
				name: formData.name,
				institution: formData.institution || null,
				current_balance: parseFloat(formData.current_balance) || 0,
				target_balance: visibility.showTargetGoal ? parseFloat(formData.target_balance) || null : null,
				original_amount: visibility.showOriginalAmount ? parseFloat(formData.original_amount) || null : null,
				interest_rate: percentInputToRate(formData.interest_rate),
				// The monthly interest job only pays accounts with an interest type, as the add form sets.
				interest_type: formData.interest_rate ? (account.interest_type ?? "compound") : null,
				notes: isNotesEmpty(formData.notes) ? null : formData.notes,
				payment_due_date: formData.payment_due_date ? parseInt(formData.payment_due_date) : null,
				...(visibility.showStatementDay && formData.statement_day !== (account.statement_day?.toString() || "")
					? { statement_day: formData.statement_day ? parseInt(formData.statement_day) : null }
					: {}),
				credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
				loan_term_months: formData.loan_term_months ? parseInt(formData.loan_term_months) : null,
				field_visibility: isOtherType ? fieldConfig : null,
				...(visibility.showContributionRoom ? toContributionRoomInput(contribution) : {}),
				...toFeeTermsInput(feeTerms, visibility),
			};
			const updates = typeChanged
				? applyTypeChange({ ...fields, account_type_id: selectedType.id }, account.account_type, selectedType)
				: fields;
			if (!updates) {
				toast.error("Couldn't change the account type", {
					description: "Pick a type from the list.",
				});
				return;
			}
			// Sample data: the account page keeps the change in the demo store (via onSuccess).
			const result = isSampleDataActive() ? updates : await updateAccount(account.id, updates);

			if (result) {
				toast.success("Account updated");
				onSuccess({
					...account,
					...result,
					account_type: selectedType,
				});
				onOpenChange(false);
			} else {
				toast.error("Couldn't save your changes", {
					description: "Failed to update account details. Please try again.",
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Something went wrong", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl sm:max-w-[650px]">
				<DialogHeader>
					<DialogTitle>Edit account</DialogTitle>
					<DialogDescription>Change this account's details and settings.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					{/* Account Name */}
					<div className="space-y-2">
						<Label htmlFor="name">
							Account Name <span className="text-error">*</span>
						</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) => {
								setFormData({ ...formData, name: e.target.value });
								if (errors.name) setErrors({ ...errors, name: undefined });
							}}
							className={errors.name ? "border-error" : ""}
						/>
						{errors.name && <p className="text-sm text-error">{errors.name}</p>}
					</div>

					{/* Institution */}
					<div className="space-y-2">
						<Label htmlFor="institution">{visibility.institutionLabel}</Label>
						<Input
							id="institution"
							value={formData.institution}
							onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
							placeholder={visibility.institutionPlaceholder}
						/>
					</div>

					{/* Account Type: same class only, since past activity is signed by it */}
					<div className="space-y-2">
						<Label htmlFor="account_type">Account Type</Label>
						<Select value={selectedType.id} onValueChange={pickType}>
							<SelectTrigger id="account_type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{typeOptions.map((type) => (
									<SelectItem key={type.id} value={type.id}>
										{type.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{typeChangeNotes.length > 0 ? (
							<ul className="space-y-1 type-body-xs text-muted-foreground">
								{typeChangeNotes.map((note) => (
									<li key={note}>{note}</li>
								))}
							</ul>
						) : (
							<p className="type-body-xs text-muted-foreground">
								{selectedType.class === "liability"
									? "To track something you own instead, add a new account."
									: "To track something you owe instead, add a new account."}
							</p>
						)}
					</div>

					{/* Generic Base Fields */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="current_balance">{isInvestment ? INVESTMENT_BALANCE_LABEL : "Current Balance"}</Label>
							<Input
								id="current_balance"
								type="text"
								inputMode="decimal"
								placeholder="0.00"
								value={formData.current_balance}
								onChange={(e) => {
									const val = sanitizeDecimalInput(e.target.value, 2);
									setFormData({ ...formData, current_balance: val });
									if (errors.current_balance) setErrors({ ...errors, current_balance: undefined });
								}}
								className={errors.current_balance ? "border-error" : ""}
							/>
							{errors.current_balance ? (
								<p className="text-sm text-error">{errors.current_balance}</p>
							) : (
								isInvestment && <p className="type-body-xs text-muted-foreground">{INVESTMENT_BALANCE_HINT}</p>
							)}
						</div>

						{isOtherType && (
							<div className="space-y-2">
								<Label>Fields to track</Label>
								<AccountFieldConfigurator
									value={fieldConfig}
									onChange={setFieldConfig}
									accountClass={selectedType.class}
								/>
							</div>
						)}

						{visibility.showTargetGoal && (
							<div className="space-y-2">
								<Label htmlFor="target_balance">Target Goal</Label>
								<Input
									id="target_balance"
									type="text"
									inputMode="decimal"
									placeholder="0.00"
									value={formData.target_balance}
									onChange={(e) => {
										const val = sanitizeDecimalInput(e.target.value, 2);
										setFormData({ ...formData, target_balance: val });
										if (errors.target_balance) setErrors({ ...errors, target_balance: undefined });
									}}
									className={errors.target_balance ? "border-error" : ""}
								/>
								{errors.target_balance && <p className="text-sm text-error">{errors.target_balance}</p>}
							</div>
						)}
					</div>

					{/* Credit-specific fields */}
					{visibility.showCreditLimit && (
						<>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="credit_limit">Credit Limit (Optional)</Label>
									<Input
										id="credit_limit"
										type="text"
										inputMode="decimal"
										placeholder="e.g., 5000"
										value={formData.credit_limit}
										onChange={(e) => {
											setFormData({ ...formData, credit_limit: sanitizeDecimalInput(e.target.value, 2) });
										}}
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
										/>
									</div>
								)}
							</div>
							<div className={cn("grid grid-cols-1 gap-4", visibility.showStatementDay && "sm:grid-cols-2")}>
								{visibility.showStatementDay && (
									<div className="space-y-2">
										<Label htmlFor="statement_day">Statement Close Date (1-31)</Label>
										<Input
											id="statement_day"
											type="text"
											inputMode="numeric"
											placeholder="e.g., 21"
											value={formData.statement_day}
											onChange={(e) =>
												setFormData({ ...formData, statement_day: sanitizeIntegerInput(e.target.value) })
											}
										/>
									</div>
								)}
								<div className="space-y-2">
									<Label htmlFor="interest_rate">{visibility.interestRateLabel}</Label>
									<Input
										id="interest_rate"
										type="text"
										inputMode="decimal"
										placeholder="e.g., 19.99"
										value={formData.interest_rate}
										onChange={(e) => {
											const val = sanitizeDecimalInput(e.target.value, 2);
											setFormData({ ...formData, interest_rate: val });
											if (errors.interest_rate) setErrors({ ...errors, interest_rate: undefined });
										}}
										className={errors.interest_rate ? "border-error" : ""}
									/>
									{errors.interest_rate && <p className="text-sm text-error">{errors.interest_rate}</p>}
								</div>
							</div>
						</>
					)}

					{/* Debt-specific fields */}
					{visibility.showOriginalAmount && (
						<>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="original_amount">Original Loan Amount</Label>
									<Input
										id="original_amount"
										type="text"
										inputMode="decimal"
										placeholder="e.g., 15000"
										value={formData.original_amount}
										onChange={(e) => {
											setFormData({ ...formData, original_amount: sanitizeDecimalInput(e.target.value, 2) });
										}}
									/>
								</div>
								{visibility.showLoanTerm && (
									<div className="space-y-2">
										<Label htmlFor="loan_term_months">Loan Term (Months)</Label>
										<Input
											id="loan_term_months"
											type="text"
											inputMode="numeric"
											placeholder="e.g., 60"
											value={formData.loan_term_months}
											onChange={(e) =>
												setFormData({ ...formData, loan_term_months: sanitizeIntegerInput(e.target.value) })
											}
										/>
									</div>
								)}
							</div>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								{visibility.showDueDate && (
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
										/>
									</div>
								)}
								<div className="space-y-2">
									<Label htmlFor="interest_rate">{visibility.interestRateLabel}</Label>
									<Input
										id="interest_rate"
										type="text"
										inputMode="decimal"
										placeholder="e.g., 5.50"
										value={formData.interest_rate}
										onChange={(e) => {
											const val = sanitizeDecimalInput(e.target.value, 2);
											setFormData({ ...formData, interest_rate: val });
											if (errors.interest_rate) setErrors({ ...errors, interest_rate: undefined });
										}}
										className={errors.interest_rate ? "border-error" : ""}
									/>
									{errors.interest_rate && <p className="text-sm text-error">{errors.interest_rate}</p>}
								</div>
							</div>
						</>
					)}

					{/* Investment/Retirement fields */}
					{visibility.showContributionRoom && (
						<ContributionRoomFields
							values={contribution}
							planRooms={planRooms}
							onChange={(changes) => {
								setContribution((prev) => ({ ...prev, ...changes }));
								if (errors.contribution_room) setErrors({ ...errors, contribution_room: undefined });
							}}
							error={errors.contribution_room}
						/>
					)}

					{/* Default interest rate for banking/property/other */}
					{visibility.showInterestRate && !visibility.showCreditLimit && !visibility.showOriginalAmount && (
						<div className="space-y-2">
							<Label htmlFor="interest_rate">{visibility.interestRateLabel}</Label>
							<Input
								id="interest_rate"
								type="text"
								inputMode="decimal"
								placeholder="e.g., 4.5"
								value={formData.interest_rate}
								onChange={(e) => {
									const val = sanitizeDecimalInput(e.target.value, 2);
									setFormData({ ...formData, interest_rate: val });
									if (errors.interest_rate) setErrors({ ...errors, interest_rate: undefined });
								}}
								className={errors.interest_rate ? "border-error" : ""}
							/>
							{errors.interest_rate && <p className="text-sm text-error">{errors.interest_rate}</p>}
						</div>
					)}

					<FeeTermsFields
						values={feeTerms}
						onChange={(changes) => setFeeTerms((prev) => ({ ...prev, ...changes }))}
						visibility={visibility}
					/>

					{/* Notes */}
					<div className="space-y-2">
						<Label htmlFor="notes">Notes</Label>
						<ScratchPad
							id="notes"
							aria-label="Notes"
							toolbar="always"
							value={formData.notes}
							onChange={(value) => setFormData({ ...formData, notes: value })}
							placeholder="Promo ends in May, call to lower the rate…"
							minLines={3}
						/>
					</div>

					<DialogFooter className="flex gap-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancel
							<CancelShortcut />
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Saving..." : "Save Changes"}
							<SubmitShortcut />
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
