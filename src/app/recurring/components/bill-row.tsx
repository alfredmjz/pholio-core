"use client";

import { RecurringExpense } from "../actions";
import { format } from "date-fns";
import { MoreVertical, CalendarIcon, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BillRowProps {
    bill: RecurringExpense;
}

export function BillRow({ bill }: BillRowProps) {
    const dueDate = new Date(bill.next_due_date);
    const isPastDue = new Date() > dueDate;

    return (
        <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
            <div className="flex items-center gap-4">
                <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors",
                    isPastDue ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                )}>
                    {bill.name.substring(0, 2).toUpperCase()}
                </div>

                <div className="flex flex-col">
                    <span className="font-semibold text-sm">{bill.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                        {bill.billing_period}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-6 md:gap-8">
                <div className="flex flex-col items-end">
                     <span className="font-bold text-sm">${Number(bill.amount).toFixed(2)}</span>
                     <div className={cn("flex items-center gap-1.5 text-xs", isPastDue ? "text-destructive font-medium" : "text-muted-foreground")}>
                        {isPastDue ? <AlertCircle className="w-3 h-3" /> : <CalendarIcon className="w-3 h-3" />}
                        <span>Due {format(dueDate, "MMM d")}</span>
                     </div>
                </div>

                <div className="hidden md:block">
                     {isPastDue ? (
                        <Badge variant="destructive" className="h-6">Past Due</Badge>
                     ) : (
                        <Badge variant="secondary" className="h-6">Upcoming</Badge>
                     )}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => toast.info("Mark as paid functionality coming soon")}>
                            Mark as Paid
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Edit functionality coming soon")}>
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => toast.info("Delete functionality coming soon")}>
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
