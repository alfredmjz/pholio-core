"use client";

import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";

/**
 * Displayed when no account is selected in the AccountDetailPanel.
 */
export function EmptyAccountState() {
	return (
		<Card className="h-full flex items-center justify-center text-center p-12">
			<div className="max-w-sm flex flex-col items-center gap-4">
				<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
					<Building2 className="h-8 w-8 text-muted-foreground" />
				</div>
				<div className="flex flex-col gap-2">
					<h3 className="text-lg font-semibold">No Account Selected</h3>
					<p className="text-sm text-muted-foreground">
						Select an account from the sidebar to view details and transactions
					</p>
				</div>
			</div>
		</Card>
	);
}
