"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, Calendar } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import {
	getAllocationSettings,
	updateAllocationSettings,
	type AllocationNewMonthDefault,
} from "@/app/settings/actions";

export default function PreferencesCard() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// Local state for non-persisted settings
	const [currency, setCurrency] = useState("CAD");
	const [language, setLanguage] = useState("en");
	const [emailNotifications, setEmailNotifications] = useState(true);
	const [pushNotifications, setPushNotifications] = useState(false);

	// Allocation settings (persisted)
	const [newMonthDefault, setNewMonthDefault] = useState<AllocationNewMonthDefault>("dialog");
	const [isLoadingSettings, setIsLoadingSettings] = useState(true);

	useEffect(() => {
		setMounted(true);
		// Load allocation settings
		getAllocationSettings().then((settings) => {
			setNewMonthDefault(settings.newMonthDefault);
			setIsLoadingSettings(false);
		});
	}, []);

	const handleNewMonthDefaultChange = async (value: AllocationNewMonthDefault) => {
		const previousValue = newMonthDefault;
		setNewMonthDefault(value);

		const result = await updateAllocationSettings({ newMonthDefault: value });
		if (!result.success) {
			setNewMonthDefault(previousValue);
			toast.error(result.error || "Failed to update setting");
		} else {
			toast.success("Setting updated");
		}
	};

	if (!mounted) {
		return null; // or a skeleton loader
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Preferences</CardTitle>
				<CardDescription>Customize your application experience</CardDescription>
			</CardHeader>
			<CardContent className="space-y-8">
				{/* Appearance Section */}
				<div className="space-y-4">
					<div>
						<h3 className="text-sm font-medium leading-none mb-1">Appearance</h3>
						<p className="text-sm text-primary">Select your preferred theme for the application.</p>
					</div>

					<ToggleGroup
						type="single"
						value={theme}
						onValueChange={(value) => value && setTheme(value)}
						className="justify-start gap-4"
					>
						<ToggleGroupItem
							value="light"
							aria-label="Light Code"
							className="h-24 w-full max-w-[140px] flex flex-col gap-2 rounded-lg border-2 border-muted hover:border-primary hover:bg-transparent data-[state=on]:border-primary data-[state=on]:bg-primary/5"
						>
							<Sun className="h-6 w-6" />
							<span className="text-xs font-medium">Light</span>
						</ToggleGroupItem>

						<ToggleGroupItem
							value="dark"
							aria-label="Dark Mode"
							className="h-24 w-full max-w-[140px] flex flex-col gap-2 rounded-lg border-2 border-muted hover:border-primary hover:bg-transparent data-[state=on]:border-primary data-[state=on]:bg-primary/5"
						>
							<Moon className="h-6 w-6" />
							<span className="text-xs font-medium">Dark</span>
						</ToggleGroupItem>

						<ToggleGroupItem
							value="system"
							aria-label="System Mode"
							className="h-24 w-full max-w-[140px] flex flex-col gap-2 rounded-lg border-2 border-muted hover:border-primary hover:bg-transparent data-[state=on]:border-primary data-[state=on]:bg-primary/5"
						>
							<Monitor className="h-6 w-6" />
							<span className="text-xs font-medium">System</span>
						</ToggleGroupItem>
					</ToggleGroup>
				</div>

				{/* Allocations Section */}
				<div className="space-y-4">
					<div>
						<h3 className="text-sm font-medium leading-none mb-1">Allocations</h3>
						<p className="text-sm text-primary">Configure how new months are handled in budget allocations.</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="newMonthDefault">New Month Default</Label>
						<Select
							value={newMonthDefault}
							onValueChange={(value) => handleNewMonthDefaultChange(value as AllocationNewMonthDefault)}
							disabled={isLoadingSettings}
						>
							<SelectTrigger id="newMonthDefault" className="w-full max-w-[300px]">
								<SelectValue placeholder="Select default behavior" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="dialog">Ask me each time</SelectItem>
								<SelectItem value="import_previous">Import from previous month</SelectItem>
								<SelectItem value="template">Use default template</SelectItem>
								<SelectItem value="fresh">Start fresh (blank)</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							This setting controls what happens when you navigate to a month without a budget.
						</p>
					</div>
				</div>

				{/* Regional Settings */}
				<div className="space-y-4">
					<div>
						<h3 className="text-sm font-medium leading-none mb-1">Regional Settings</h3>
						<p className="text-sm text-primary">Set your preferred language and currency.</p>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="currency">Currency</Label>
							<Select value={currency} onValueChange={setCurrency}>
								<SelectTrigger id="currency">
									<SelectValue placeholder="Select currency" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="USD">USD ($)</SelectItem>
									<SelectItem value="CAD">CAD ($)</SelectItem>
									<SelectItem value="EUR">EUR (€)</SelectItem>
									<SelectItem value="GBP">GBP (£)</SelectItem>
									<SelectItem value="JPY">JPY (¥)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="language">Language</Label>
							<Select value={language} onValueChange={setLanguage}>
								<SelectTrigger id="language">
									<SelectValue placeholder="Select language" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="en">English</SelectItem>
									<SelectItem value="fr">Français</SelectItem>
									<SelectItem value="es">Español</SelectItem>
									<SelectItem value="de">Deutsch</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{/* Notifications */}
				<div className="space-y-4">
					<div>
						<h3 className="text-sm font-medium leading-none mb-1">Notifications</h3>
						<p className="text-sm text-primary">Manage how you want to receive alerts.</p>
					</div>

					<div className="space-y-4">
						<div className="flex items-center justify-between rounded-lg border border-border p-4">
							<div className="space-y-0.5">
								<Label className="text-base">Email Notifications</Label>
								<p className="text-sm text-primary">Receive daily summaries and critical alerts.</p>
							</div>
							<Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
						</div>

						<div className="flex items-center justify-between rounded-lg border border-border p-4">
							<div className="space-y-0.5">
								<Label className="text-base">Push Notifications</Label>
								<p className="text-sm text-primary">Receive real-time alerts on your device.</p>
							</div>
							<Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
