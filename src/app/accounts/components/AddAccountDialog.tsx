"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
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
import { ScratchPad } from "@/components/common/scratch-pad";
import { StepIndicator } from "@/components/common/step-indicator";
import { isNotesEmpty } from "@/lib/notes";
import { isSampleDataActive } from "@/lib/demo-mode";
import { useDemoStore } from "@/lib/demo-store";
import { getContributionRooms, saveContributionRoom } from "@/lib/actions/contribution-actions";
import type { ContributionRoomSetting } from "@/lib/types/contribution";
import { createAccount, getAccountTypes } from "../actions";
import type { CreateAccountInput, AccountType, AccountClass, AccountWithType, AccountFieldConfig } from "../types";
import { getFieldVisibility } from "../field-visibility";
import {
	EMPTY_CONTRIBUTION_ROOM_VALUES,
	toContributionRoomInput,
	toPlanRoomSetting,
	validateContributionRoom,
	type ContributionRoomFormValues,
} from "../contribution-room-form";
import { EMPTY_FEE_TERMS_VALUES, toFeeTermsInput, type FeeTermsFormValues } from "../fee-terms-form";
import { TypeStep } from "./add-account/type-step";
import { DetailsStep, EMPTY_ACCOUNT_FORM, type AccountFormState } from "./add-account/details-step";

interface AddAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: (account: AccountWithType) => void;
}

interface ValidationErrors {
	account_type_id?: string;
	name?: string;
	contribution_room?: string;
}

const STEPS = ["Type", "Details", "Notes"] as const;
const STEP_DESCRIPTION = [
	"Is it something you own or something you owe, and what kind?",
	"What to call it and what's in it today.",
	"Anything to remember about it. You can skip this.",
];

/** Adds an account in three steps: the kind of account, its details, then optional notes. */
export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
	const [step, setStep] = useState(0);
	const [loading, setLoading] = useState(false);
	const [accountClass, setAccountClass] = useState<AccountClass>("asset");
	const [allAccountTypes, setAllAccountTypes] = useState<AccountType[]>([]);
	const [form, setForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
	const [fieldConfig, setFieldConfig] = useState<AccountFieldConfig>({});
	const [contribution, setContribution] = useState<ContributionRoomFormValues>(EMPTY_CONTRIBUTION_ROOM_VALUES);
	const [planRooms, setPlanRooms] = useState<ContributionRoomSetting[]>([]);
	const [feeTerms, setFeeTerms] = useState<FeeTermsFormValues>(EMPTY_FEE_TERMS_VALUES);
	const [errors, setErrors] = useState<ValidationErrors>({});

	const setField = <K extends keyof AccountFormState>(key: K, value: AccountFormState[K]) => {
		setForm((prev) => ({ ...prev, [key]: value }));
		if (key === "name" && errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
	};

	useEffect(() => {
		getAccountTypes().then(setAllAccountTypes);
	}, []);

	// Every open starts fresh at step one; plan rooms are shared across accounts, so reload them.
	useEffect(() => {
		if (!open) return;
		setStep(0);
		setAccountClass("asset");
		setForm(EMPTY_ACCOUNT_FORM);
		setFieldConfig({});
		setContribution(EMPTY_CONTRIBUTION_ROOM_VALUES);
		setFeeTerms(EMPTY_FEE_TERMS_VALUES);
		setErrors({});
		getContributionRooms()
			.then(setPlanRooms)
			.catch(() => setPlanRooms([]));
	}, [open]);

	const selectedType = allAccountTypes.find((type) => type.id === form.account_type_id);
	// "Other" accounts get their field set from the configurator.
	const isOtherType = selectedType?.code === "other";
	const visibility = getFieldVisibility(selectedType, isOtherType ? fieldConfig : null);

	// A different type tracks different figures; drop what the new one doesn't use.
	const pickType = (typeId: string) => {
		const type = allAccountTypes.find((t) => t.id === typeId);
		if (!type) return;
		const vis = getFieldVisibility(type, type.code === "other" ? fieldConfig : null);
		setForm((prev) => ({
			...prev,
			account_type_id: typeId,
			target_balance: vis.showTargetGoal ? prev.target_balance : "",
			original_amount: vis.showOriginalAmount ? prev.original_amount : "",
			credit_limit: vis.showCreditLimit ? prev.credit_limit : "",
			interest_rate: vis.showInterestRate ? prev.interest_rate : "",
			loan_term_months: vis.showLoanTerm ? prev.loan_term_months : "",
			payment_due_date: vis.showDueDate ? prev.payment_due_date : "",
			statement_day: vis.showStatementDay ? prev.statement_day : "",
		}));
		if (!vis.showContributionRoom) setContribution(EMPTY_CONTRIBUTION_ROOM_VALUES);
		setErrors({});
		setStep(1);
	};

	const validateStep = (index: number): boolean => {
		const next: ValidationErrors = {};
		if (index === 0 && !form.account_type_id) next.account_type_id = "Pick the kind of account";
		if (index === 1) {
			if (!form.name.trim()) next.name = "Give the account a name";
			const roomError = validateContributionRoom(contribution);
			if (roomError) next.contribution_room = roomError;
		}
		setErrors(next);
		return Object.keys(next).length === 0;
	};

	const createAccountNow = async () => {
		if (!validateStep(0) || !validateStep(1)) return;
		setLoading(true);
		try {
			const planRoom = toPlanRoomSetting(contribution, planRooms);
			if (planRoom && !(await saveContributionRoom(planRoom))) {
				toast.error("Couldn't create the account", { description: "Couldn't save your contribution room. Try again." });
				return;
			}

			const input: CreateAccountInput = {
				name: form.name.trim(),
				account_type_id: form.account_type_id,
				// A blank balance means the account starts at zero.
				current_balance: form.current_balance.trim() ? parseFloat(form.current_balance) : 0,
				interest_rate: form.interest_rate ? parseFloat(form.interest_rate) / 100 : null,
				interest_type: form.interest_rate ? "compound" : null,
				target_balance: form.target_balance ? parseFloat(form.target_balance) : null,
				original_amount: form.original_amount ? parseFloat(form.original_amount) : null,
				institution: form.institution.trim() || null,
				notes: isNotesEmpty(form.notes) ? null : form.notes,
				payment_due_date: form.payment_due_date ? parseInt(form.payment_due_date) : null,
				...(form.statement_day ? { statement_day: parseInt(form.statement_day) } : {}),
				credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
				loan_term_months: form.loan_term_months ? parseInt(form.loan_term_months) : null,
				field_visibility: isOtherType ? fieldConfig : null,
				...toContributionRoomInput(contribution),
				...toFeeTermsInput(feeTerms, visibility),
			};

			const result = await createAccount(input);
			if (result) {
				// Demo mode: the server returns a mock account without persisting; record it
				// in-memory so it appears for the duration of the session.
				if (isSampleDataActive()) useDemoStore.getState().addAccount(result);
				toast.success("Account created successfully");
				onOpenChange(false);
				onSuccess(result);
			} else {
				toast.error("Couldn't create the account", { description: "Check the details and try again." });
			}
		} catch (err) {
			toast.error("Something went wrong", {
				description: err instanceof Error ? err.message : "An unexpected error occurred.",
			});
		} finally {
			setLoading(false);
		}
	};

	// Every step's main button submits; the step decides whether that means "next" or "create".
	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (step < STEPS.length - 1) {
			if (validateStep(step)) setStep(step + 1);
			return;
		}
		void createAccountNow();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Add account</DialogTitle>
					<DialogDescription>{STEP_DESCRIPTION[step]}</DialogDescription>
				</DialogHeader>

				<StepIndicator steps={[...STEPS]} current={step} onStepClick={(index) => setStep(index)} className="mt-1" />

				<form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
					{step === 0 && (
						<TypeStep
							accountClass={accountClass}
							onClassChange={(next) => {
								setAccountClass(next);
								setForm((prev) => ({ ...prev, account_type_id: "" }));
								setErrors({});
							}}
							types={allAccountTypes}
							selectedTypeId={form.account_type_id}
							onPick={pickType}
							error={errors.account_type_id}
						/>
					)}

					{step === 1 && selectedType && (
						<DetailsStep
							form={form}
							setField={setField}
							errors={errors}
							accountClass={accountClass}
							selectedType={selectedType}
							visibility={visibility}
							fieldConfig={fieldConfig}
							onFieldConfigChange={setFieldConfig}
							contribution={contribution}
							planRooms={planRooms}
							onContributionChange={(changes) => {
								setContribution((prev) => ({ ...prev, ...changes }));
								if (errors.contribution_room) setErrors((prev) => ({ ...prev, contribution_room: undefined }));
							}}
							feeTerms={feeTerms}
							onFeeTermsChange={(changes) => setFeeTerms((prev) => ({ ...prev, ...changes }))}
							onChangeType={() => setStep(0)}
						/>
					)}

					{step === 2 && (
						<div className="space-y-2">
							<p className="type-label text-primary">Notes for {form.name.trim() || "this account"}</p>
							<ScratchPad
								id="account-notes"
								aria-label={`Notes for ${form.name.trim() || "this account"}`}
								toolbar="always"
								minLines={5}
								value={form.notes}
								onChange={(value) => setField("notes", value)}
								placeholder="Promo rate ends in May. Ask about the annual fee…"
								autoFocus
							/>
						</div>
					)}

					<DialogFooter>
						{step === 0 ? (
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
								Cancel
								<CancelShortcut />
							</Button>
						) : (
							<Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>
								Back
							</Button>
						)}
						<Button type="submit" disabled={loading}>
							{step < STEPS.length - 1 ? "Continue" : loading ? "Creating…" : "Create Account"}
							<SubmitShortcut />
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
