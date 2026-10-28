"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { CircleOff, CloudSun, Monitor, Moon, Sun, Wind } from "lucide-react";
import { useBackdrop } from "@/components/providers/weather-provider";
import type { BackdropPreference } from "@/lib/backdrop-preference";
import { SegmentedChoice, type SegmentedOption } from "@/components/common/segmented-choice";
import { InfoTip } from "@/components/common/info-tip";
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
		<SettingsSection id="appearance" title="Appearance">
			<SettingRow label="Theme">
				<SegmentedChoice
					label="Theme"
					value={mounted ? (theme as ThemeChoice) : undefined}
					options={THEME_OPTIONS}
					onChange={setTheme}
				/>
			</SettingRow>
			<SettingRow
				label="Background"
				description={
					backdrop === "adaptive" && (
						<>
							Adaptive turns sunny, cloudy, windy or rainy with how your finances are going.{" "}
							<InfoTip label="How Adaptive works">
								<p className="type-label text-primary">How Adaptive works</p>
								<p className="mt-1.5">
									Pholio looks at your month so far: your budget, your income and spending, your bills and your balances
									over time.
								</p>
								<ul className="mt-2 space-y-1">
									<li>
										<span className="text-primary">Sunny:</span> you&apos;re on track.
									</li>
									<li>
										<span className="text-primary">Cloudy:</span> mostly fine, with a few things to watch.
									</li>
									<li>
										<span className="text-primary">Windy:</span> a busy, up-and-down stretch.
									</li>
									<li>
										<span className="text-primary">Rainy:</span> money is tight, or a bill is overdue.
									</li>
								</ul>
								<p className="mt-2">It updates as you add transactions. Only you can see it.</p>
							</InfoTip>
						</>
					)
				}
			>
				<SegmentedChoice label="Background" value={backdrop} options={BACKDROP_OPTIONS} onChange={setBackdrop} />
			</SettingRow>
		</SettingsSection>
	);
}
