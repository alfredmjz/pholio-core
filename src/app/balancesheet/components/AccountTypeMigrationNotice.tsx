"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAccountsNeedingTypeMigration } from "../actions";
import type { AccountTypeMigrationItem } from "../types";
import { AccountTypeMigrationDialog } from "./AccountTypeMigrationDialog";

/**
 * One-time guided migration for accounts whose type was retired by migration 006.
 *
 * Self-terminating: renders only while at least one account still needs a type, so there is
 * no flag or stored state to maintain.
 *
 * TODO(#99-cleanup): delete this component, the dialog, the migration actions and the legacy
 * category bridge in field-visibility.ts once the pending set is permanently empty.
 */
export function AccountTypeMigrationNotice() {
	const router = useRouter();
	const [items, setItems] = useState<AccountTypeMigrationItem[]>([]);
	const [isDismissed, setIsDismissed] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const loadPending = useCallback(async () => {
		const pending = await getAccountsNeedingTypeMigration();
		setItems(pending);
	}, []);

	useEffect(() => {
		void loadPending();
	}, [loadPending]);

	if (items.length === 0 || isDismissed) return null;

	const accountLabel = items.length === 1 ? "1 account needs" : `${items.length} accounts need`;

	return (
		<>
			<div className="flex items-start justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
				<div className="flex items-start gap-3">
					<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
					<div>
						<p className="text-sm font-semibold text-primary">Your account types were updated</p>
						<p className="text-xs text-muted-foreground">
							{accountLabel} a type. Choose one to keep balance and debt tracking accurate.
						</p>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button size="sm" onClick={() => setIsDialogOpen(true)}>
						Review
					</Button>
					<Button
						size="icon"
						variant="ghost"
						aria-label="Dismiss account type notice"
						onClick={() => setIsDismissed(true)}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<AccountTypeMigrationDialog
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				items={items}
				onComplete={() => {
					void loadPending();
					router.refresh();
				}}
			/>
		</>
	);
}
