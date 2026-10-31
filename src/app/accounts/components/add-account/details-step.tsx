"use client";

import { Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { cn } from "@/lib/utils";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "@/lib/input-utils";
import type { ContributionRoomSetting } from "@/lib/types/contribution";
import type { AccountClass, AccountFieldConfig, AccountType, AccountTypeCode } from "../../types";
import type { FieldVisibility } from "../../field-visibility";
import type { ContributionRoomFormValues } from "../../contribution-room-form";
import type { FeeTermsFormValues } from "../../fee-terms-form";
import { AccountFieldConfigurator } from "../AccountFieldConfigurator";
import { ContributionRoomFields } from "../ContributionRoomFields";
import { FeeTermsFields } from "../FeeTermsFields";
import { TYPE_ICON } from "../account-row";

export interface AccountFormState {
	name: string;
	account_type_id: string;
	current_balance: string;
	target_balance: string;
	original_amount: string;
	interest_rate: string;
	institution: string;
	notes: string;
	payment_due_date: string;
	statement_day: string;
	credit_limit: string;
	loan_term_months: string;
}

export const EMPTY_ACCOUNT_FORM: AccountFormState = {
	name: "",
	account_type_id: "",
	current_balance: "",
	target_balance: "",
	original_amount: "",
	interest_rate: "",
	institution: "",
	notes: "",
	payment_due_date: "",
	statement_day: "",
	credit_limit: "",
	loan_term_months: "",
};

interface DetailsStepProps {
	form: AccountFormState;
	setField: <K extends keyof AccountFormState>(key: K, value: AccountFormState[K]) => void;
	errors: { name?: string; contribution_room?: string };
	accountClass: AccountClass;
	selectedType: AccountType;
	visibility: FieldVisibility;
	fieldConfig: AccountFieldConfig;
	onFieldConfigChange: (config: AccountFieldConfig) => void;
	contribution: ContributionRoomFormValues;
	planRooms: ContributionRoomSetting[];
	onContributionChange: (changes: Partial<ContributionRoomFormValues>) => void;
	feeTerms: FeeTermsFormValues;
	onFeeTermsChange: (changes: Partial<FeeTermsFormValues>) => void;
	onChangeType: () => void;
}

/** A plain label + text input pair, the common case below. */
function TextField({
	id,
	label,
	value,
	onChange,
	placeholder,
	inputMode,
	error,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	inputMode?: "text" | "numeric" | "decimal";
	error?: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				value={value}
				inputMode={inputMode}
				placeholder={placeholder}
				onChange={(event) => onChange(event.target.value)}
				className={cn("h-10", error && "border-error")}
			/>
			{error && <p className="type-body-xs text-error">{error}</p>}
		</div>
	);
}

/** Step two: what to call it, where it is, what's in it, and the figures this type tracks. */
export function DetailsStep({
	form,
	setField,
	errors,
	accountClass,
	selectedType,
	visibility,
	fieldConfig,
	onFieldConfigChange,
	contribution,
	planRooms,
	onContributionChange,
	feeTerms,
	onFeeTermsChange,
	onChangeType,
}: DetailsStepProps) {
	const Icon = TYPE_ICON[(selectedType.code as AccountTypeCode) ?? "other"] ?? Wallet;
	const isOther = selectedType.code === "other";
	const isLiability = accountClass === "liability";
	const rateLabel = visibility.interestRateLabel.replace(" (%)", "");

	return (
		<div className="flex flex-col gap-6">
			{/* What was picked in step one, with a way back. */}
			<div className="flex items-center gap-3 rounded-2xl bg-primary/[0.04] px-3 py-2.5">
				<span
					className={cn(
						"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
						isLiability ? "bg-error-muted text-error" : "bg-card-muted text-primary"
					)}
					aria-hidden
				>
					<Icon className="h-4 w-4" />
				</span>
				<span className="type-body-sm min-w-0 flex-1 truncate">
					<span className="font-medium text-primary">{selectedType.name}</span>
					<span className="text-muted-foreground"> · {isLiability ? "What you owe" : "What you own"}</span>
				</span>
				<button
					type="button"
					onClick={onChangeType}
					className="type-body-sm shrink-0 rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-primary/[0.05] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					Change
				</button>
			</div>

			<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="name">
						Account name <span className="text-error">*</span>
					</Label>
					<Input
						id="name"
						autoFocus
						placeholder={isLiability ? "e.g. Visa Infinite" : "e.g. Emergency fund"}
						value={form.name}
						onChange={(event) => setField("name", event.target.value)}
						className={cn("h-10", errors.name && "border-error")}
					/>
					{errors.name && <p className="type-body-xs text-error">{errors.name}</p>}
				</div>
				<TextField
					id="institution"
					label={visibility.institutionLabel}
					value={form.institution}
					onChange={(value) => setField("institution", value)}
					placeholder={visibility.institutionPlaceholder}
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="balance" className="type-label text-muted-foreground">
					{isLiability ? "Current balance owing" : "Current balance"}
				</Label>
				<ProminentAmountInput
					id="balance"
					value={form.current_balance}
					onChange={(value) => setField("current_balance", value)}
				/>
				<p className="type-body-xs text-muted-foreground">Leave it blank to start at $0.00.</p>
			</div>

			{isOther && (
				<div className="space-y-2">
					<Label>Fields to track</Label>
					<AccountFieldConfigurator value={fieldConfig} onChange={onFieldConfigChange} accountClass={accountClass} />
				</div>
			)}

			{(visibility.showTargetGoal ||
				visibility.showOriginalAmount ||
				visibility.showCreditLimit ||
				visibility.showInterestRate ||
				visibility.showDueDate ||
				visibility.showLoanTerm) && (
				<div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
					{visibility.showTargetGoal && (
						<div className="space-y-2">
							<Label htmlFor="target">Goal</Label>
							<ProminentAmountInput
								id="target"
								value={form.target_balance}
								onChange={(value) => setField("target_balance", value)}
							/>
						</div>
					)}
					{visibility.showOriginalAmount && (
						<div className="space-y-2">
							<Label htmlFor="original_amount">Original amount borrowed</Label>
							<ProminentAmountInput
								id="original_amount"
								value={form.original_amount}
								onChange={(value) => setField("original_amount", value)}
							/>
						</div>
					)}
					{visibility.showCreditLimit && (
						<div className="space-y-2">
							<Label htmlFor="credit_limit">Credit limit</Label>
							<ProminentAmountInput
								id="credit_limit"
								value={form.credit_limit}
								onChange={(value) => setField("credit_limit", value)}
							/>
						</div>
					)}
					{visibility.showInterestRate && (
						<TextField
							id="interest"
							label={`${rateLabel} (%)`}
							inputMode="decimal"
							value={form.interest_rate}
							onChange={(value) => setField("interest_rate", sanitizeDecimalInput(value, 2))}
							placeholder={isLiability ? "19.99" : "4.00"}
						/>
					)}
					{visibility.showDueDate && (
						<TextField
							id="payment_due_date"
							label="Payment due (day of month)"
							inputMode="numeric"
							value={form.payment_due_date}
							onChange={(value) => setField("payment_due_date", sanitizeIntegerInput(value))}
							placeholder="e.g. 21"
						/>
					)}
					{visibility.showStatementDay && (
						<TextField
							id="statement_day"
							label="Statement closes (day of month)"
							inputMode="numeric"
							value={form.statement_day}
							onChange={(value) => setField("statement_day", sanitizeIntegerInput(value))}
							placeholder="21 days before due"
						/>
					)}
					{visibility.showLoanTerm && (
						<TextField
							id="loan_term"
							label="Loan term (months)"
							inputMode="numeric"
							value={form.loan_term_months}
							onChange={(value) => setField("loan_term_months", sanitizeIntegerInput(value))}
							placeholder="e.g. 60"
						/>
					)}
				</div>
			)}

			{visibility.showContributionRoom && (
				<ContributionRoomFields
					values={contribution}
					planRooms={planRooms}
					onChange={onContributionChange}
					error={errors.contribution_room}
				/>
			)}

			<FeeTermsFields values={feeTerms} onChange={onFeeTermsChange} visibility={visibility} />
		</div>
	);
}
