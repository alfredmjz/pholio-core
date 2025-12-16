"use client";

import { useState } from "react";
import { RecurringExpense, toggleSubscription } from "../actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SubscriptionRow } from "./subscription-row";
import { BillCard } from "./bill-card";
import { AddRecurringDialog } from "./add-recurring-dialog";

interface RecurringClientProps {
	initialExpenses: RecurringExpense[];
}

export function RecurringClient({ initialExpenses }: RecurringClientProps) {
    const [expenses, setExpenses] = useState<RecurringExpense[]>(initialExpenses);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // Derived state
    const subscriptions = expenses.filter(e => e.category === 'subscription');
    const bills = expenses.filter(e => e.category === 'bill');

    // Summary stats
    const totalMonthly = expenses
        .filter(e => e.is_active)
        .reduce((sum, e) => {
            // Normalize to monthly
            let amount = Number(e.amount);
            if (e.billing_period === 'yearly') amount /= 12;
            if (e.billing_period === 'weekly') amount *= 4; // Approx
            if (e.billing_period === 'biweekly') amount *= 2; // Approx
            return sum + amount;
        }, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Recurring</h1>
                    <p className="text-muted-foreground">Manage your subscriptions and recurring bills.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Recurring
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Fixed Cost</CardTitle>
                        <span className="text-muted-foreground">$</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalMonthly.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Estimated from active items
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{subscriptions.filter(s => s.is_active).length}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="subscriptions" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                    <TabsTrigger value="bills">Bills</TabsTrigger>
                </TabsList>
                <TabsContent value="subscriptions" className="space-y-4">
                    {subscriptions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No subscriptions found. Add one to get started.
                        </div>
                    ) : (
                        <Card>
                            <div className="divide-y">
                                {subscriptions.map(sub => (
                                    <SubscriptionRow key={sub.id} subscription={sub} />
                                ))}
                            </div>
                        </Card>
                    )}
                </TabsContent>
                <TabsContent value="bills" className="space-y-4">
                    {bills.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No bills found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {bills.map(bill => (
                                <BillCard key={bill.id} bill={bill} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <AddRecurringDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
        </div>
    );
}
