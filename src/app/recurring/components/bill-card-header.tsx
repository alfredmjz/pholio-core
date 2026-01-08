import { Button } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MoreVertical } from "lucide-react";
import { RecurringExpense } from "../actions";

interface BillCardHeaderProps {
	bill: RecurringExpense;
	isAutomated: boolean;
	isDeleting: boolean;
	onPayFuture: () => void;
	onEdit: () => void;
	onDelete: () => void;
}

export function BillCardHeader({ bill, isAutomated, isDeleting, onPayFuture, onEdit, onDelete }: BillCardHeaderProps) {
	return (
		<CardHeader className="flex flex-row items-start justify-between p-5 pb-2 space-y-0">
			<div className="flex items-center gap-3">
				<div
					className={cn(
						"h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm transition-colors",
						"bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
					)}
				>
					{bill.name.substring(0, 2).toUpperCase()}
				</div>
				<div className="flex flex-col">
					<span className="font-semibold leading-none tracking-tight">{bill.name}</span>
					<span className="text-xs text-muted-foreground capitalize mt-1">{bill.billing_period}</span>
				</div>
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground/60 hover:text-foreground">
						<MoreVertical className="h-4 w-4" />
						<span className="sr-only">Open menu</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{!isAutomated && <DropdownMenuItem onClick={onPayFuture}>Pay Future Bill</DropdownMenuItem>}
					<DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem className="text-error" onClick={onDelete} disabled={isDeleting}>
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</CardHeader>
	);
}
