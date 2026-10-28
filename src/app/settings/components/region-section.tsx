"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, formatDateParts, getLocaleOptions, type Currency, type FormatLocale } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updatePreferences, updateTimezone } from "../actions";
import { SettingRow, SettingsSection } from "./settings-section";
import { useSavedSetting } from "./use-saved-setting";

const FALLBACK_TIMEZONES = [
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/New_York",
	"America/Toronto",
	"Asia/Shanghai",
	"Asia/Tokyo",
	"Australia/Sydney",
	"Europe/London",
	"Europe/Paris",
	"UTC",
];

interface RegionSectionProps {
	timezone: string | null;
	currency: Currency;
	locale: FormatLocale;
}

export function RegionSection({
	timezone: savedTimezone,
	currency: savedCurrency,
	locale: savedLocale,
}: RegionSectionProps) {
	const [currency, setCurrency, savingCurrency] = useSavedSetting(savedCurrency, (value) =>
		updatePreferences({ defaultCurrency: value })
	);
	const [locale, setLocale, savingLocale] = useSavedSetting(savedLocale, (value) =>
		updatePreferences({ locale: value })
	);

	// 31 January shows whether the day or the month comes first.
	const localeOptions = useMemo(() => getLocaleOptions(new Date(new Date().getFullYear(), 0, 31)), []);

	return (
		<SettingsSection id="region" title="Region">
			<TimezoneRow savedTimezone={savedTimezone} />

			<SettingRow
				label="Default currency"
				htmlFor="defaultCurrency"
				description="Amounts aren't converted, only the symbol changes."
			>
				<Select value={currency} onValueChange={(value) => setCurrency(value as Currency)} disabled={savingCurrency}>
					<SelectTrigger id="defaultCurrency" className="w-full row-wide:w-64">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CURRENCIES.map((code) => (
							<SelectItem key={code} value={code}>
								{code}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingRow>

			<SettingRow
				label="Number and date format"
				htmlFor="locale"
				description="Pholio's text stays in English."
			>
				<Select value={locale} onValueChange={(value) => setLocale(value as FormatLocale)} disabled={savingLocale}>
					<SelectTrigger id="locale" className="w-full row-wide:w-64">
						<SelectValue>{localeOptions.find((option) => option.value === locale)?.label}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{localeOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
								<span className="ml-2 text-muted-foreground">{option.example}</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingRow>
		</SettingsSection>
	);
}

function TimezoneRow({ savedTimezone }: { savedTimezone: string | null }) {
	const [systemTimezone, setSystemTimezone] = useState("");
	const [open, setOpen] = useState(false);
	const [timezone, setTimezone, saving] = useSavedSetting<string | null>(savedTimezone, updateTimezone);
	const [clock, setClock] = useState("");

	const allTimezones = useMemo(() => {
		try {
			return Intl.supportedValuesOf("timeZone");
		} catch {
			return FALLBACK_TIMEZONES;
		}
	}, []);

	useEffect(() => setSystemTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

	const shown = timezone ?? systemTimezone;

	useEffect(() => {
		if (!shown) return;
		const tick = () => {
			try {
				setClock(
					formatDateParts(new Date(), {
						timeZone: shown,
						weekday: "short",
						month: "short",
						day: "numeric",
						hour: "numeric",
						minute: "2-digit",
					})
				);
			} catch {
				setClock("");
			}
		};
		tick();
		const interval = setInterval(tick, 15_000);
		return () => clearInterval(interval);
	}, [shown]);

	const pick = (next: string | null) => {
		setOpen(false);
		setTimezone(next);
	};

	return (
		<SettingRow
			label="Time zone"
			htmlFor="timezone"
			description={
				clock ? (
					<>
						It's <span className="tabular-nums text-primary">{clock}</span> there.
					</>
				) : undefined
			}
		>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						id="timezone"
						variant="outline"
						role="combobox"
						aria-expanded={open}
						disabled={saving}
						className="w-full justify-between font-normal row-wide:w-64"
					>
						<span className="flex min-w-0 items-center gap-2">
							<Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
							<span className="truncate">
								{shown ? shown.replace(/_/g, " ") : "Choose a time zone"}
								{timezone === null && shown && <span className="ml-1 text-muted-foreground">(device)</span>}
							</span>
						</span>
						<ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[calc(100vw-2rem)] p-0 sm:w-[380px]" align="end">
					<Command>
						<CommandInput placeholder="Search time zones..." />
						<CommandList>
							<CommandEmpty>No time zone found.</CommandEmpty>
							<CommandGroup heading="Default">
								<CommandItem value={`device ${systemTimezone}`} onSelect={() => pick(null)}>
									<Check className={cn("mr-2 h-4 w-4", timezone === null ? "opacity-100" : "opacity-0")} />
									Use this device&apos;s ({systemTimezone.replace(/_/g, " ")})
								</CommandItem>
							</CommandGroup>
							<CommandGroup heading="All time zones">
								{allTimezones.map((zone) => (
									<CommandItem key={zone} value={zone} onSelect={() => pick(zone)}>
										<Check className={cn("mr-2 h-4 w-4", timezone === zone ? "opacity-100" : "opacity-0")} />
										{zone.replace(/_/g, " ")}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</SettingRow>
	);
}
