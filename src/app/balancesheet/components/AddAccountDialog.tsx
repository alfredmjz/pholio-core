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
import { FormSection } from "@/components/FormSection";
import { CardSelector } from "@/components/CardSelector";

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
	const [loading, setLoading] = useState(false);
	const [accountType, setAccountType] = useState<AccountClass>("asset");
	const [allAccountTypes, setAllAccountTypes] = useState<AccountType[]>([]);
	const [formData, setFormData] = useState<Partial<CreateAccountInput>>({});
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
				toast.error("Failed to create category");
			}
		} catch (error) {
			toast.error("Error creating category");
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

		if (formData.current_balance === undefined || formData.current_balance === null) {
			newErrors.current_balance = "Current balance is required";
			isValid = false;
		}

		// Target balance is required for assets, but optional (or 0) for liabilities
		if (accountType === "asset") {
			if (formData.target_balance === undefined || formData.target_balance === null) {
				newErrors.target_balance = "Target goal is required";
				isValid = false;
			}
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
				name: formData.name!,
				account_type_id: formData.account_type_id!,
				current_balance: formData.current_balance!,
				interest_rate: formData.interest_rate || null,
				interest_type: formData.interest_rate ? "compound" : null,
				target_balance: formData.target_balance || null,
				institution: formData.institution || null,
				notes: formData.notes || null,
			};

			const result = await createAccount(input);

			if (result) {
				toast.success("Account created successfully");
				onOpenChange(false);
				onSuccess(result);
				// Reset form
				setFormData({});
				setErrors({});
				setSearchValue("");
			} else {
				toast.error("Failed to create account");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setLoading(false);
		}
	};

	const availableTypes = (allAccountTypes || []).filter((t) => t.class === accountType);
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
									account_type_id: undefined,
									current_balance: undefined,
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
									value={formData.name || ""}
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
									<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
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
								<Input
									id="balance"
									type="number"
									inputMode="decimal"
									step="0.01"
									placeholder="0.00"
									value={formData.current_balance ?? ""}
									onChange={(e) => {
										const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
										setFormData({ ...formData, current_balance: val });
										if (errors.current_balance) setErrors({ ...errors, current_balance: undefined });
									}}
									className={cn("h-10", errors.current_balance && "border-error")}
								/>
								{errors.current_balance && <p className="text-sm text-error">{errors.current_balance}</p>}
							</div>

							<div className="space-y-2">
								<Label htmlFor="target">
									{accountType === "asset" ? "Target Goal" : "Original Amount"}{" "}
									{accountType === "asset" && <span className="text-error">*</span>}
								</Label>
								<Input
									id="target"
									type="number"
									inputMode="decimal"
									step="0.01"
									placeholder="0.00"
									value={formData.target_balance ?? ""}
									onChange={(e) => {
										const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
										setFormData({ ...formData, target_balance: val });
										if (errors.target_balance) setErrors({ ...errors, target_balance: undefined });
									}}
									className={cn("h-10", errors.target_balance && "border-error")}
								/>
								{errors.target_balance && <p className="text-sm text-error">{errors.target_balance}</p>}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="interest">Interest Rate ({accountType === "asset" ? "APY" : "APR"} %)</Label>
								<Input
									id="interest"
									type="number"
									inputMode="decimal"
									step="0.01"
									placeholder="5.50"
									value={formData.interest_rate ? formData.interest_rate * 100 : ""}
									onChange={(e) =>
										setFormData({ ...formData, interest_rate: parseFloat(e.target.value) / 100 || null })
									}
									className="h-10"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="institution">Institution/Lender</Label>
								<Input
									id="institution"
									placeholder="Chase, Ally Bank, etc."
									value={formData.institution || ""}
									onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
									className="h-10"
								/>
							</div>
						</div>
					</FormSection>

					{/* Notes - Optional section */}
					<FormSection variant="subtle">
						<div className="space-y-2">
							<Label>Notes</Label>
							<MinimalTiptap
								content={formData.notes || ""}
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
