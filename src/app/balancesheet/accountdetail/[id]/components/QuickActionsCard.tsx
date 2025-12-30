"use client";

import { BanknoteArrowDown, PiggyBank, Edit } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QuickActionsCardProps {
	onAddDeposit: () => void;
	onRecordWithdrawal: () => void;
	onEditDetails: () => void;
}

export function QuickActionsCard({ onAddDeposit, onRecordWithdrawal, onEditDetails }: QuickActionsCardProps) {
	return (
		<Card className="p-4">
			<h3 className="text-sm font-semibold text-primary mb-3">Quick Actions</h3>
			<div className="flex flex-col gap-1">
				<Button variant="ghost" className="w-full justify-start gap-3 h-11 px-3 hover:bg-hover" onClick={onAddDeposit}>
					<PiggyBank className="h-4 w-4 text-green-600" />
					<span className="font-medium">Add Deposit</span>
				</Button>
				<Button
					variant="ghost"
					className="w-full justify-start gap-3 h-11 px-3 hover:bg-hover"
					onClick={onRecordWithdrawal}
				>
					<BanknoteArrowDown className="h-4 w-4 text-error" />
					<span className="font-medium">Record Withdrawal</span>
				</Button>
				<Button variant="ghost" className="w-full justify-start gap-3 h-11 px-3 hover:bg-hover" onClick={onEditDetails}>
					<Edit className="h-4 w-4 text-primary" />
					<span className="font-medium">Edit Details</span>
				</Button>
			</div>
		</Card>
	);
}
