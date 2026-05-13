"use client";

import { useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, Globe, ChevronsUpDown, Check, Wallet, Bell } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getUserTemplates } from "@/app/allocations/actions";
import {
	getAllocationSettings,
	updateAllocationSettings,
	getTimezone,
	updateTimezone,
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
	const [initialNewMonthDefault, setInitialNewMonthDefault] = useState<AllocationNewMonthDefault>("dialog");
	const [initialDefaultTemplateId, setInitialDefaultTemplateId] = useState<string>("none");
	
	const [newMonthDefault, setNewMonthDefault] = useState<AllocationNewMonthDefault>("dialog");
	const [defaultTemplateId, setDefaultTemplateId] = useState<string>("none");
	const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
	const [isLoadingSettings, setIsLoadingSettings] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	// Timezone settings (persisted)
	const [initialTimezone, setInitialTimezone] = useState<string>("");
	const [timezone, setTimezone] = useState<string>("");
	const [timezoneOpen, setTimezoneOpen] = useState(false);
	const [systemTimezone, setSystemTimezone] = useState<string>("");

	// Get all available timezones from the browser
	const allTimezones = useMemo(() => {
		try {
			return Intl.supportedValuesOf("timeZone");
		} catch {
			return [
				"UTC",
				"America/New_York",
				"America/Chicago",
				"America/Denver",
				"America/Los_Angeles",
				"America/Toronto",
				"Europe/London",
				"Europe/Paris",
				"Asia/Tokyo",
				"Asia/Shanghai",
				"Australia/Sydney",
			];
		}
	}, []);

	useEffect(() => {
		setMounted(true);

		// Detect system timezone
		const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
		setSystemTimezone(detected);

		// Load allocation settings and templates
		Promise.all([getAllocationSettings(), getUserTemplates()]).then(([settings, userTemplates]) => {
			setInitialNewMonthDefault(settings.newMonthDefault);
			setNewMonthDefault(settings.newMonthDefault);
			
			const defaultTpl = settings.defaultTemplateId || "none";
			setInitialDefaultTemplateId(defaultTpl);
			setDefaultTemplateId(defaultTpl);
			
			setTemplates(userTemplates);
			setIsLoadingSettings(false);
		});

		// Load timezone setting
		getTimezone().then((saved) => {
			const tz = saved || detected;
			setInitialTimezone(tz);
			setTimezone(tz);
		});
	}, []);

	// Live clock for timezone verification
	const [currentTime, setCurrentTime] = useState<string>("");
	useEffect(() => {
		const updateClock = () => {
			if (!timezone) return;
			try {
				const now = new Date();
				const formatted = now.toLocaleString("en-US", {
					timeZone: timezone,
					weekday: "short",
					year: "numeric",
					month: "short",
					day: "numeric",
					hour: "numeric",
					minute: "2-digit",
					second: "2-digit",
				});
				setCurrentTime(formatted);
			} catch {
				setCurrentTime("");
			}
		};
		updateClock();
		const interval = setInterval(updateClock, 1000);
		return () => clearInterval(interval);
	}, [timezone]);

	const handleNewMonthDefaultChange = (value: AllocationNewMonthDefault) => {
		setNewMonthDefault(value);
	};

	const handleDefaultTemplateIdChange = (value: string) => {
		setDefaultTemplateId(value);
	};

	const handleTimezoneChange = (tz: string | null) => {
		setTimezone(tz || systemTimezone);
		setTimezoneOpen(false);
	};

	const handleCancel = () => {
		setNewMonthDefault(initialNewMonthDefault);
		setDefaultTemplateId(initialDefaultTemplateId);
		setTimezone(initialTimezone);
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const allocPromise = updateAllocationSettings({
				newMonthDefault,
				defaultTemplateId: defaultTemplateId === "none" ? null : defaultTemplateId,
			});
			const tzPromise = updateTimezone(timezone);
			
			const [allocResult, tzResult] = await Promise.all([allocPromise, tzPromise]);
			
			if (!allocResult.success || !tzResult.success) {
				toast.error("Save Failed", { description: "Some settings could not be saved." });
			} else {
				toast.success("Settings saved successfully");
				setInitialNewMonthDefault(newMonthDefault);
				setInitialDefaultTemplateId(defaultTemplateId);
				setInitialTimezone(timezone);
			}
		} finally {
			setIsSaving(false);
		}
	};

	const hasChanges =
		newMonthDefault !== initialNewMonthDefault ||
		defaultTemplateId !== initialDefaultTemplateId ||
		timezone !== initialTimezone;

	if (!mounted) {
		return null; // or a skeleton loader
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Preferences</CardTitle>
				<CardDescription>Customize your application experience</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Appearance Section */}
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<Sun className="h-5 w-5 text-muted-foreground shrink-0" />
						<div>
							<h3 className="text-base font-semibold tracking-tight">Appearance</h3>
							<p className="text-sm text-muted-foreground">Select your preferred theme for the application.</p>
						</div>
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

				<hr className="border-border" />

				{/* Allocations Section */}
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
						<div>
							<h3 className="text-base font-semibold tracking-tight">Allocations</h3>
							<p className="text-sm text-muted-foreground">
								Configure how new months are handled in budget allocations.
							</p>
						</div>
					</div>

					<div className="space-y-4">
						<div className="space-y-2.5">
							<Label className="text-sm font-semibold" htmlFor="newMonthDefault">
								New Month Default (Page Navigation)
							</Label>
							<Select
								value={newMonthDefault}
								onValueChange={(value) => handleNewMonthDefaultChange(value as AllocationNewMonthDefault)}
								disabled={isLoadingSettings}
							>
								<SelectTrigger id="newMonthDefault" className="w-full max-w-[300px] bg-background">
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
								Controls what happens when you navigate to a month without a budget.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="defaultTemplate">Default Template</Label>
							<Select
								value={defaultTemplateId}
								onValueChange={handleDefaultTemplateIdChange}
								disabled={isLoadingSettings}
							>
								<SelectTrigger id="defaultTemplate" className="w-full max-w-[300px]">
									<SelectValue placeholder="Select default template" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None (use first created)</SelectItem>
									{templates.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">
								Applied automatically when a new month's budget is auto-created.
							</p>
						</div>
					</div>
				</div>

				<hr className="border-border" />

				{/* Regional Settings */}
				<div className="flex gap-4">
					<div className="flex-1 space-y-6">
						<div className="flex items-center gap-3">
							<Globe className="h-5 w-5 text-muted-foreground shrink-0" />
							<div>
								<h3 className="text-base font-semibold tracking-tight">Regional Settings</h3>
								<p className="text-sm text-muted-foreground">Set your preferred language, currency, and timezone.</p>
							</div>
						</div>

						{/* Timezone */}
						<div className="space-y-2.5">
							<Label className="text-sm font-semibold">Timezone</Label>
							<div className="flex flex-col gap-2.5">
								<Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={timezoneOpen}
											className="w-full max-w-[300px] justify-between font-normal bg-background active:scale-100 hover:bg-background transition-none duration-0"
										>
											<div className="flex items-center gap-2 truncate">
												<Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
												<span className="truncate">
													{timezone || "Select timezone..."}
													{timezone === systemTimezone && <span className="text-muted-foreground ml-1">(System)</span>}
												</span>
											</div>
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="w-[400px] p-0 data-[state=open]:animate-none data-[state=closed]:animate-none"
										align="start"
									>
										<Command>
											<CommandInput placeholder="Search timezones..." className="transition-none duration-0" />
											<CommandList>
												<CommandEmpty>No timezone found.</CommandEmpty>
												<CommandGroup heading="System Default">
													<CommandItem value={`system-${systemTimezone}`} onSelect={() => handleTimezoneChange(null)}>
														<Check
															className={cn("mr-2 h-4 w-4", timezone === systemTimezone ? "opacity-100" : "opacity-0")}
														/>
														{systemTimezone} (System detected)
													</CommandItem>
												</CommandGroup>
												<CommandGroup heading="All Timezones">
													{allTimezones.map((tz) => (
														<CommandItem key={tz} value={tz} onSelect={() => handleTimezoneChange(tz)}>
															<Check className={cn("mr-2 h-4 w-4", timezone === tz ? "opacity-100" : "opacity-0")} />
															{tz.replace(/_/g, " ")}
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>

								{currentTime && (
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
										<span className="font-mono whitespace-nowrap">{currentTime}</span>
									</div>
								)}
							</div>
						</div>
						<div className="flex gap-8">
							<div className="space-y-2.5 w-full max-w-[300px]">
								<Label className="text-sm font-semibold" htmlFor="currency">
									Currency
								</Label>
								<Select value={currency} onValueChange={setCurrency}>
									<SelectTrigger id="currency" className="bg-background">
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

							<div className="space-y-2.5 w-full max-w-[300px]">
								<Label className="text-sm font-semibold" htmlFor="language">
									Language
								</Label>
								<Select value={language} onValueChange={setLanguage}>
									<SelectTrigger id="language" className="bg-background">
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
				</div>

				<hr className="border-border" />

				{/* Notifications */}
				<div className="flex gap-4">
					<div className="flex-1 space-y-4">
						<div className="flex items-center gap-3">
							<Bell className="h-5 w-5 text-muted-foreground" />
							<div>
								<h3 className="text-base font-semibold tracking-tight">Notifications</h3>
								<p className="text-sm text-muted-foreground">Manage how you want to receive alerts.</p>
							</div>
						</div>
						<div className="divide-y divide-border -mt-2">
							<div className="flex items-center justify-between py-6">
								<div className="space-y-1">
									<Label className="text-sm font-semibold">Email Notifications</Label>
									<p className="text-sm text-muted-foreground">Receive daily summaries and critical alerts.</p>
								</div>
								<Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
							</div>

							<div className="flex items-center justify-between py-6">
								<div className="space-y-1">
									<Label className="text-sm font-semibold">Push Notifications</Label>
									<p className="text-sm text-muted-foreground">Receive real-time alerts on your device.</p>
								</div>
								<Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
							</div>
						</div>
					</div>
				</div>

				<hr className="border-border" />

				{/* Save/Cancel Action */}
				<div className="flex justify-end gap-3 pt-2">
					<Button 
						variant="outline" 
						onClick={handleCancel} 
						disabled={!hasChanges || isSaving || isLoadingSettings}
					>
						Cancel
					</Button>
					<Button 
						onClick={handleSave} 
						disabled={!hasChanges || isSaving || isLoadingSettings}
					>
						{isSaving ? "Saving..." : "Save Changes"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
