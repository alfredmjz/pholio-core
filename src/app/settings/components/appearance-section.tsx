"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { CircleOff, CloudSun, Monitor, Moon, Sun, Wind } from "lucide-react";
import { useBackdrop } from "@/components/providers/weather-provider";
import type { BackdropPreference } from "@/lib/backdrop-preference";
import { SegmentedChoice, type SegmentedOption } from "@/components/common/segmented-choice";
import { SettingRow, SettingsSection } from "./settings-section";

type ThemeChoice = "dark" | "light" | "system";

const THEME_OPTIONS: SegmentedOption<ThemeChoice>[] = [
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "system", label: "System", icon: Monitor },
];

// "None" stays first as the pinned catch-all (ADR-003).
const BACKDROP_OPTIONS: SegmentedOption<BackdropPreference>[] = [
	{ value: "none", label: "None", ariaLabel: "No Background", icon: CircleOff },
	{ value: "adaptive", label: "Adaptive", ariaLabel: "Adaptive Background", icon: CloudSun },
	{ value: "wind", label: "Wind", ariaLabel: "Wind Background", icon: Wind },
];

export function AppearanceSection() {
	const { theme, setTheme } = useTheme();
	const { backdrop, setBackdrop } = useBackdrop();
	// The theme is only known in the browser.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	return (
		<SettingsSection id="appearance" title="Appearance" note="Saved on this device.">
			<SettingRow label="Theme" description="System follows your device's light or dark mode.">
				<SegmentedChoice
					label="Theme"
					value={mounted ? (theme as ThemeChoice) : undefined}
					options={THEME_OPTIONS}
					onChange={setTheme}
				/>
			</SettingRow>
			<SettingRow
				label="Background"
				description="Adaptive turns sunny, cloudy, windy or rainy with how your finances are going."
			>
				<SegmentedChoice label="Background" value={backdrop} options={BACKDROP_OPTIONS} onChange={setBackdrop} />
			</SettingRow>
		</SettingsSection>
	);
}
