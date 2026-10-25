"use client";

import { PresetManager } from "@/components/dialogs/preset-manager";
import type { AccountWithType } from "@/app/accounts/types";
import type { AllocationCategory } from "@/app/allocations/types";
import { SettingsSection } from "./settings-section";

interface PresetsSectionProps {
	categories: AllocationCategory[];
	accounts: AccountWithType[];
}

export function PresetsSection({ categories, accounts }: PresetsSectionProps) {
	return (
		<SettingsSection
			id="presets"
			title="Presets"
			note="Transactions and transfers you record often, ready to add from the transaction dialog."
		>
			<PresetManager categories={categories} accounts={accounts} />
		</SettingsSection>
	);
}
