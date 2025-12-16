"use client";

import { RecurringExpense } from "../actions";
import { format } from "date-fns";
import { CalendarIcon, DollarSign } from "lucide-react";

interface BillRowProps {
    bill: RecurringExpense;
}

export function BillRow({ bill }: BillRowProps) {
    const dueDate = new Date(bill.next_due_date);
    const isPastDue = new Date() > dueDate;

    return (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer">
             <div className="flex flex-col gap-1">
                 <span className="font-medium">{bill.name}</span>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        Next Due: {format(dueDate, "MMM d, yyyy")}
                     </span>
                     {isPastDue && <span className="text-destructive font-medium text-xs">Past Due</span>}
                 </div>
             </div>
             <div className="flex items-center gap-4">
                 <div className="text-right">
                     <div className="font-bold text-lg">${Number(bill.amount).toFixed(2)}</div>
                     <div className="text-xs text-muted-foreground capitalize">{bill.billing_period}</div>
                 </div>
             </div>
        </div>
    )
}
