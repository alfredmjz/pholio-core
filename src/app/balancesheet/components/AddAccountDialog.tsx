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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MinimalTiptap } from "@/components/ui/shadcn-io/minimal-tiptap";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Wallet, Info } from "lucide-react";
import { createAccount, getAccountTypes, createAccountType } from "../actions";
import type { CreateAccountInput, AccountType, AccountClass, AccountWithType } from "../types";
import { cn } from "@/lib/utils";
import { validateDecimalInput } from "@/lib/input-utils";
import { FormSection } from "@/components/FormSection";
import { CardSelector } from "@/components/CardSelector";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { Switch } from "@/components/ui/switch";

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
}

export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
	interface FormState {
		name: string;
		account_type_id: string;
		current_balance: string;
		target_balance: string;
		interest_rate: string;
		institution: string;
		notes: string;
		payment_due_date: string;
		credit_limit: string;
		loan_term_months: string;
		track_contribution_room: boolean;
		contribution_room: string;
		annual_contribution_limit: string;
	}

	const [loading, setLoading] = useState(false);
	const [accountType, setAccountType] = useState<AccountClass>("asset");
	const [allAccountTypes, setAllAccountTypes] = useState<AccountType[]>([]);
	const [formData, setFormData] = useState<FormState>({
		name: "",
		account_type_id: "",
		current_balance: "",
		target_balance: "",
		interest_rate: "",
		institution: "",
		notes: "",
		payment_due_date: "",
		credit_limit: "",
		loan_term_months: "",
		track_contribution_room: false,
		contribution_room: "",
		annual_contribution_limit: "",
	});
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [openCombobox, setOpenCombobox] = useState(false);
	const [searchValue, setSearchValue] = useState("");

	// Fetch account types on mount
	useEffect(() => {
		const fetchTypes = async () => {
			const types = await getAccountTypes();
			setAllAccountTypes(types);
		};
		fetchTypes();
	}, []);

	const handleCreateType = async () => {
		if (!searchValue) return;
		setLoading(true);
		try {
			const newType = await createAccountType({
				name: searchValue,
				class: accountType,
				category: "other",
			});

			if (newType) {
				setAllAccountTypes((prev) => [...prev, newType]);
				setFormData({ ...formData, account_type_id: newType.id });
				setErrors({ ...errors, account_type_id: undefined });
				setOpenCombobox(false);
				setSearchValue("");
				toast.success(`Category "${searchValue}" created`);
			} else {
				toast.error("Category Failed", {
					description: `Failed to create category "${searchValue}".`,
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Category Error", {
				description: errorMessage,
			});
		} finally {
			setLoading(false);
		}
	};

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

		if (!formData.current_balance.trim()) {
			newErrors.current_balance = "Current balance is required";
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
			const input: CreateAccountInput = {
				name: formData.name,
				account_type_id: formData.account_type_id,
				current_balance: parseFloat(formData.current_balance),
				interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) / 100 : null,
				interest_type: formData.interest_rate ? "compound" : null,
				target_balance: formData.target_balance ? parseFloat(formData.target_balance) : null,
				institution: formData.institution || null,
				notes: formData.notes || null,
				payment_due_date: formData.payment_due_date ? parseInt(formData.payment_due_date) : null,
				credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
				loan_term_months: formData.loan_term_months ? parseInt(formData.loan_term_months) : null,
				track_contribution_room: formData.track_contribution_room,
				contribution_room: formData.contribution_room ? parseFloat(formData.contribution_room) : null,
				annual_contribution_limit: formData.annual_contribution_limit
					? parseFloat(formData.annual_contribution_limit)
					: null,
			};

			const result = await createAccount(input);

			if (result) {
				toast.success("Account created successfully");
				onOpenChange(false);
				onSuccess(result);
				// Reset form
				setFormData({
					name: "",
					account_type_id: "",
					current_balance: "",
					target_balance: "",
					interest_rate: "",
					institution: "",
					notes: "",
					payment_due_date: "",
					credit_limit: "",
					loan_term_months: "",
					track_contribution_room: false,
					contribution_room: "",
					annual_contribution_limit: "",
				});
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
									icon: "💰",
									color: "bg-green-100",
								},
								{
									value: "liability" as AccountClass,
									label: "Liability",
									icon: "💳",
									color: "bg-red-100",
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
						<div className="grid grid-cols-2 gap-4">
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
												placeholder="Search or create category..."
												value={searchValue}
												onValueChange={setSearchValue}
											/>
											<CommandList>
												<CommandEmpty className="p-0">
													<Button
														variant="ghost"
														className="w-full justify-start rounded-none px-4 py-2 h-auto text-sm"
														onClick={handleCreateType}
													>
														<Plus className="mr-2 h-4 w-4" />
														Create "{searchValue}"
													</Button>
												</CommandEmpty>
												<CommandGroup>
													{availableTypes.map((type) => (
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

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="balance">
									Current Balance <span className="text-error">*</span>
								</Label>
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

							{(!selectedType ||
								(selectedType.category !== "credit" &&
									selectedType.category !== "debt" &&
									selectedType.category !== "investment" &&
									selectedType.category !== "retirement")) && (
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

						{/* Dynamic Fields based on Category */}
						{selectedType?.category === "credit" && (
							<>
								<div className="grid grid-cols-2 gap-4 mt-4">
									<div className="space-y-2">
										<Label htmlFor="credit_limit">Credit Limit (Optional)</Label>
										<ProminentAmountInput
											id="credit_limit"
											value={formData.credit_limit}
											onChange={(val) => setFormData({ ...formData, credit_limit: val })}
											hasError={false}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="payment_due_date">Payment Due Date (1-31)</Label>
										<Input
											id="payment_due_date"
											type="number"
											min="1"
											max="31"
											placeholder="e.g., 21"
											value={formData.payment_due_date}
											onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
											className="h-10"
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4 mt-4">
									<div className="space-y-2">
										<Label htmlFor="interest">APR (%)</Label>
										<Input
											id="interest"
											type="text"
											inputMode="decimal"
											placeholder="19.99"
											value={formData.interest_rate}
											onChange={(e) => {
												const val = e.target.value;
												if (validateDecimalInput(val)) {
													setFormData({ ...formData, interest_rate: val });
												}
											}}
											className="h-10"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="institution">Institution/Lender</Label>
										<Input
											id="institution"
											placeholder="Chase, Amex, etc."
											value={formData.institution}
											onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
											className="h-10"
										/>
									</div>
								</div>
							</>
						)}

						{selectedType?.category === "debt" && (
							<>
								<div className="grid grid-cols-2 gap-4 mt-4">
									<div className="space-y-2">
										<Label htmlFor="target">Original Loan Amount</Label>
										<ProminentAmountInput
											id="target"
											value={formData.target_balance}
											onChange={(val) => setFormData({ ...formData, target_balance: val })}
											hasError={false}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="loan_term">Loan Term (Months)</Label>
										<Input
											id="loan_term"
											type="number"
											placeholder="e.g., 60"
											value={formData.loan_term_months}
											onChange={(e) => setFormData({ ...formData, loan_term_months: e.target.value })}
											className="h-10"
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4 mt-4">
									<div className="space-y-2">
										<Label htmlFor="payment_due_date">Payment Due Date (1-31)</Label>
										<Input
											id="payment_due_date"
											type="number"
											min="1"
											max="31"
											placeholder="e.g., 15"
											value={formData.payment_due_date}
											onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
											className="h-10"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="interest">APR (%)</Label>
										<Input
											id="interest"
											type="text"
											inputMode="decimal"
											placeholder="5.50"
											value={formData.interest_rate}
											onChange={(e) => {
												const val = e.target.value;
												if (validateDecimalInput(val)) {
													setFormData({ ...formData, interest_rate: val });
												}
											}}
											className="h-10"
										/>
									</div>
								</div>
								<div className="space-y-2 mt-4">
									<Label htmlFor="institution">Lender</Label>
									<Input
										id="institution"
										placeholder="Bank of America, etc."
										value={formData.institution}
										onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
										className="h-10"
									/>
								</div>
							</>
						)}

						{(selectedType?.category === "investment" || selectedType?.category === "retirement") && (
							<>
								<div className="flex flex-row items-center justify-between rounded-lg border p-4 mt-4">
									<div className="space-y-0.5">
										<Label>Track Contribution Room</Label>
										<p className="text-sm text-muted-foreground">
											Track your maximum allowable contributions (e.g., for TFSA, RRSP, FHSA).
										</p>
									</div>
									<Switch
										checked={formData.track_contribution_room}
										onCheckedChange={(checked) => setFormData({ ...formData, track_contribution_room: checked })}
									/>
								</div>

								{formData.track_contribution_room && (
									<div className="grid grid-cols-2 gap-4 mt-4">
										<div className="space-y-2">
											<Label htmlFor="contribution_room">Total Contribution Room</Label>
											<ProminentAmountInput
												id="contribution_room"
												value={formData.contribution_room}
												onChange={(val) => setFormData({ ...formData, contribution_room: val })}
												hasError={false}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="annual_limit">Annual Limit (e.g., 7000 for TFSA)</Label>
											<ProminentAmountInput
												id="annual_limit"
												value={formData.annual_contribution_limit}
												onChange={(val) => setFormData({ ...formData, annual_contribution_limit: val })}
												hasError={false}
											/>
										</div>
									</div>
								)}

								<div className="space-y-2 mt-4">
									<Label htmlFor="institution">Institution/Brokerage</Label>
									<Input
										id="institution"
										placeholder="Wealthsimple, Questrade, etc."
										value={formData.institution}
										onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
										className="h-10"
									/>
								</div>
							</>
						)}

						{(!selectedType ||
							(selectedType.category !== "credit" &&
								selectedType.category !== "debt" &&
								selectedType.category !== "investment" &&
								selectedType.category !== "retirement")) && (
							<>
								<div className="grid grid-cols-2 gap-4 mt-4">
									<div className="space-y-2">
										<Label htmlFor="interest">APY (%)</Label>
										<Input
											id="interest"
											type="text"
											inputMode="decimal"
											placeholder="4.00"
											value={formData.interest_rate}
											onChange={(e) => {
												const val = e.target.value;
												if (validateDecimalInput(val)) {
													setFormData({ ...formData, interest_rate: val });
												}
											}}
											className="h-10"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="institution">Institution</Label>
										<Input
											id="institution"
											placeholder="Chase, Ally Bank, etc."
											value={formData.institution}
											onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
											className="h-10"
										/>
									</div>
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
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? "Creating..." : "Create Account"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
