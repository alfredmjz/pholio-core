"use client";

import { useState } from "react";
import { addRecurringExpense } from "../actions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronRight, Music, Tv, Zap, CreditCard, ShoppingBag, Cloud, Film } from "lucide-react";
import { toast } from "sonner";

interface AddRecurringDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PRESET_PROVIDERS = [
    { id: "netflix", name: "Netflix", icon: Tv, color: "bg-red-500", category: "subscription" },
    { id: "spotify", name: "Spotify", icon: Music, color: "bg-green-500", category: "subscription" },
    { id: "apple", name: "Apple", icon: Cloud, color: "bg-gray-500", category: "subscription" },
    { id: "prime", name: "Amazon Prime", icon: ShoppingBag, color: "bg-blue-400", category: "subscription" },
    { id: "disney", name: "Disney+", icon: Film, color: "bg-blue-600", category: "subscription" },
    { id: "custom_sub", name: "Custom Subscription", icon: Zap, color: "bg-yellow-500", category: "subscription" },
    { id: "rent", name: "Rent", icon: CreditCard, color: "bg-purple-500", category: "bill" },
    { id: "custom_bill", name: "Custom Bill", icon: CreditCard, color: "bg-slate-500", category: "bill" },
];

export function AddRecurringDialog({ open, onOpenChange }: AddRecurringDialogProps) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        amount: "",
        billing_period: "monthly",
        next_due_date: new Date(),
        category: "subscription",
        service_provider: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleProviderSelect = (provider: any) => {
        setFormData({
            ...formData,
            name: provider.id.startsWith("custom") ? "" : provider.name,
            category: provider.category,
            service_provider: provider.id.startsWith("custom") ? "" : provider.id
        });
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.amount) {
             toast.error("Please fill in all fields");
             return;
        }

        setIsSubmitting(true);
        try {
            const result = await addRecurringExpense({
                name: formData.name,
                amount: parseFloat(formData.amount),
                billing_period: formData.billing_period,
                next_due_date: format(formData.next_due_date, "yyyy-MM-dd"),
                category: formData.category,
                service_provider: formData.service_provider,
                is_active: true,
                currency: "USD"
            });

            if (result) {
                toast.success("Recurring expense added");
                onOpenChange(false);
                // Reset form
                setStep(1);
                setFormData({
                    name: "",
                    amount: "",
                    billing_period: "monthly",
                    next_due_date: new Date(),
                    category: "subscription",
                    service_provider: "",
                });
            } else {
                toast.error("Failed to add expense");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Recurring Expense</DialogTitle>
                    <DialogDescription>
                        {step === 1 ? "Select a service provider or create custom." : "Enter expense details."}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && (
                    <div className="grid grid-cols-2 gap-4 py-4">
                        {PRESET_PROVIDERS.map((provider) => (
                            <div
                                key={provider.id}
                                className="flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors gap-2"
                                onClick={() => handleProviderSelect(provider)}
                            >
                                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white", provider.color)}>
                                    <provider.icon className="h-6 w-6" />
                                </div>
                                <span className="font-medium text-sm">{provider.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder="Netflix, Rent, etc."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                    <Input
                                        type="number"
                                        className="pl-7"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select
                                    value={formData.billing_period}
                                    onValueChange={(v) => setFormData({...formData, billing_period: v})}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="yearly">Yearly</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>First Due Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !formData.next_due_date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {formData.next_due_date ? format(formData.next_due_date, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formData.next_due_date}
                                        onSelect={(date) => date && setFormData({...formData, next_due_date: date})}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === 2 && (
                        <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
                            Back
                        </Button>
                    )}
                    {step === 2 && (
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? "Adding..." : "Add Expense"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
