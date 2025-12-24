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
import { CompactTiptap } from "@/components/ui/shadcn-io/compact-tiptap";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { createAccount, getAccountTypes, createAccountType } from "../actions";
import type { CreateAccountInput, AccountType, AccountClass, AccountWithType } from "../types";
import { cn } from "@/lib/utils";

interface AddAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: (account: AccountWithType) => void;
}

export function AddAccountDialog({ open, onOpenChange, onSuccess }: AddAccountDialogProps) {
	const [loading, setLoading] = useState(false);
	const [accountType, setAccountType] = useState<AccountClass>("asset");
	const [allAccountTypes, setAllAccountTypes] = useState<AccountType[]>([]);
	const [formData, setFormData] = useState<Partial<CreateAccountInput>>({
		current_balance: 0,
	});
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const input: CreateAccountInput = {
				name: formData.name!,
				account_type_id: formData.account_type_id!,
				current_balance: formData.current_balance || 0,
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
				setFormData({ current_balance: accountType === "asset" ? 0 : undefined });
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

	const availableTypes = allAccountTypes.filter((t) => t.class === accountType);
	const selectedType = allAccountTypes.find((t) => t.id === formData.account_type_id);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-[650px]">
				<DialogHeader>
					<DialogTitle>Add New Account</DialogTitle>
					<DialogDescription>Create a new account to track your assets or liabilities.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Account Type */}
					<div className="space-y-2">
						<Label>Account Type</Label>
						<div className="grid grid-cols-2 gap-2">
							<Button
								type="button"
								variant={accountType === "asset" ? "default" : "outline"}
								onClick={() => {
									setAccountType("asset");
									setFormData({ ...formData, account_type_id: undefined, current_balance: 0 });
								}}
								className="w-full"
							>
								Asset (Savings, Investments)
							</Button>
							<Button
								type="button"
								variant={accountType === "liability" ? "default" : "outline"}
								onClick={() => {
									setAccountType("liability");
									setFormData({ ...formData, account_type_id: undefined, current_balance: undefined });
								}}
								className="w-full"
							>
								Liability (Debt, Loans)
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Account Name */}
						<div className="space-y-2">
							<Label htmlFor="name">Account Name *</Label>
							<Input
								id="name"
								placeholder="Emergency Fund"
								className="border-border placeholder:text-muted-foreground/50"
								value={formData.name || ""}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								required
							/>
						</div>

						{/* Account Type (Category) */}
						<div className="space-y-2">
							<Label htmlFor="type-id">Category</Label>
							<Popover open={openCombobox} onOpenChange={setOpenCombobox}>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										role="combobox"
										aria-expanded={openCombobox}
										className="w-full justify-between border-border text-muted-foreground font-normal"
									>
										{selectedType ? selectedType.name : "Select category"}
										<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
												{availableTypes
													.filter((t) => t.name.toLowerCase().includes(searchValue.toLowerCase()))
													.map((type) => (
														<CommandItem
															key={type.id}
															value={type.id}
															onSelect={() => {
																setFormData({ ...formData, account_type_id: type.id });
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
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Current Balance */}
						<div className="space-y-2">
							<Label htmlFor="balance">Current Balance *</Label>
							<Input
								id="balance"
								type="number"
								step="0.01"
								placeholder="0.00"
								className="border-border placeholder:text-muted-foreground/50"
								value={formData.current_balance ?? ""}
								onChange={(e) =>
									setFormData({ ...formData, current_balance: e.target.value ? parseFloat(e.target.value) : 0 })
								}
								required
							/>
						</div>

						{/* Target Balance */}
						<div className="space-y-2">
							<Label htmlFor="target">{accountType === "asset" ? "Target Goal *" : "Original Amount *"}</Label>
							<Input
								id="target"
								type="number"
								step="0.01"
								placeholder="0.00"
								className="border-border placeholder:text-muted-foreground/50"
								value={formData.target_balance || ""}
								onChange={(e) => setFormData({ ...formData, target_balance: parseFloat(e.target.value) || null })}
								required
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{/* Interest Rate */}
						<div className="space-y-2">
							<Label htmlFor="interest">Interest Rate (APR/APY %)</Label>
							<Input
								id="interest"
								type="number"
								step="0.01"
								placeholder="5.50"
								className="border-border placeholder:text-muted-foreground/50"
								value={formData.interest_rate ? formData.interest_rate * 100 : ""}
								onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) / 100 || null })}
							/>
						</div>

						{/* Institution */}
						<div className="space-y-2">
							<Label htmlFor="institution">Institution/Lender</Label>
							<Input
								id="institution"
								placeholder="Chase, Ally Bank, etc."
								className="border-border placeholder:text-muted-foreground/50"
								value={formData.institution || ""}
								onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
							/>
						</div>
					</div>

					{/* Notes */}
					<div className="space-y-2">
						<Label>Notes</Label>
						<CompactTiptap
							content={formData.notes || ""}
							onChange={(content) => setFormData({ ...formData, notes: content })}
							placeholder="Additional information about this account..."
						/>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
							Cancel
						</Button>
						<Button type="submit" disabled={loading || !formData.name || !formData.account_type_id}>
							{loading ? "Creating..." : "Create Account"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
