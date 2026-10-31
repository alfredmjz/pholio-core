"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { SurfaceSection } from "@/components/layout/surface-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerSyncedData } from "@/hooks/useServerSyncedData";
import { getAccountCharges, removeAccountCharge } from "@/lib/actions/account-charge-actions";
import { describeCharge, describeWaiver } from "../../account-charge-form";
import type { AccountCharge, AccountWithType } from "../../types";
import { AccountChargeDialog } from "./AccountChargeDialog";

const EMPTY_CHARGES: AccountCharge[] = [];

interface AccountChargesCardProps {
	account: AccountWithType;
	/** YYYY-MM-DD in the user's timezone. */
	today: string;
	formatCurrency: (amount: number) => string;
}

/** Fees the bank charges on this account (monthly, yearly, per cash advance), which Pholio posts when due. */
export function AccountChargesCard({ account, today, formatCurrency }: AccountChargesCardProps) {
	const {
		data: charges,
		refresh,
		isLoading,
	} = useServerSyncedData<AccountCharge[]>(EMPTY_CHARGES, () => getAccountCharges(account.id), {
		fetchOnMount: true,
	});
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<AccountCharge | null>(null);
	const [removing, setRemoving] = useState<AccountCharge | null>(null);

	const openDialog = (charge: AccountCharge | null) => {
		setEditing(charge);
		setDialogOpen(true);
	};

	const handleRemove = async () => {
		if (!removing) return;
		if (await removeAccountCharge(removing.id, account.id)) {
			toast.success("Charge removed");
			void refresh();
		} else {
			toast.error("Couldn't remove the charge", { description: "Try again in a moment." });
		}
	};

	return (
		<SurfaceSection
			id="account-charges-heading"
			title="Charges"
			note="Fees the bank charges on this account"
			headerActions={
				<Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full px-3" onClick={() => openDialog(null)}>
					<Plus className="h-3.5 w-3.5" aria-hidden />
					Add charge
				</Button>
			}
		>
			{charges.length === 0 ? (
				isLoading ? (
					<Skeleton className="h-16 w-full rounded-xl" />
				) : (
					<p className="type-body-sm text-muted-foreground">
						No charges on this account. Add a monthly or annual fee and Pholio will post it when it is due.
					</p>
				)
			) : (
				<ul className="flex flex-col divide-y divide-border/50">
					{charges.map((charge) => {
						const waiver = describeWaiver(charge, formatCurrency);
						return (
							<li key={charge.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
								<div className="min-w-0">
									<p className="type-body-sm truncate font-medium text-primary">{charge.name}</p>
									<p className="type-body-xs text-muted-foreground">{describeCharge(charge, formatCurrency)}</p>
									{waiver && <p className="type-body-xs text-muted-foreground">{waiver}</p>}
								</div>
								<div className="flex shrink-0 items-center">
									<Button
										size="icon"
										variant="ghost"
										className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary"
										onClick={() => openDialog(charge)}
										aria-label={`Edit ${charge.name}`}
									>
										<Pencil className="h-3.5 w-3.5" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										className="h-8 w-8 rounded-full text-muted-foreground hover:text-error"
										onClick={() => setRemoving(charge)}
										aria-label={`Remove ${charge.name}`}
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			<AccountChargeDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				account={account}
				charge={editing}
				today={today}
				onSuccess={() => void refresh()}
			/>
			<DeleteConfirmDialog
				open={removing !== null}
				onOpenChange={(open) => !open && setRemoving(null)}
				title="Remove charge"
				confirmLabel="Remove"
				description={
					removing ? `Stop charging "${removing.name}"? Fees it already added stay in this account's activity.` : ""
				}
				onConfirm={handleRemove}
			/>
		</SurfaceSection>
	);
}
