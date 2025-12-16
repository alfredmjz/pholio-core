"use client";

import { RecurringExpense } from "../actions";
import { format } from "date-fns";
import { CalendarIcon, CreditCard, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";

interface BillCardProps {
    bill: RecurringExpense;
}

export function BillCard({ bill }: BillCardProps) {
    const dueDate = new Date(bill.next_due_date);
    const isPastDue = new Date() > dueDate;

    return (
        <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
            {isPastDue && (
                 <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
            )}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                     <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                         {bill.name.substring(0, 2).toUpperCase()}
                     </div>
                     <CardTitle className="text-sm font-medium leading-none">
                         {bill.name}
                     </CardTitle>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => toast.info("Edit functionality coming soon")}>
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => toast.info("Delete functionality coming soon")}>
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${Number(bill.amount).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground capitalize mb-4">
                    {bill.billing_period}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        Due {format(dueDate, "MMM d")}
                    </span>
                    {isPastDue ? (
                        <Badge variant="destructive" className="h-5 px-1.5 py-0">Past Due</Badge>
                    ) : (
                         <Badge variant="secondary" className="h-5 px-1.5 py-0">Upcoming</Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
