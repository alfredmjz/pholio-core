"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortAlphabetically } from "@/lib/sort-utils";
import { updateAllocationSettings, type AllocationNewMonthDefault } from "../actions";
import { SettingRow, SettingsSection } from "./settings-section";
import { useSavedSetting } from "./use-saved-setting";

const NO_TEMPLATE = "none";

const NEW_MONTH_OPTIONS: { value: AllocationNewMonthDefault; label: string }[] = [
	{ value: "dialog", label: "Ask me each time" },
	{ value: "import_previous", label: "Copy the previous month" },
	{ value: "fresh", label: "Start blank" },
	{ value: "template", label: "Use the default template" },
];

interface BudgetingSectionProps {
	newMonthDefault: AllocationNewMonthDefault;
	defaultTemplateId: string | null;
	templates: { id: string; name: string }[];
}

export function BudgetingSection({ newMonthDefault, defaultTemplateId, templates }: BudgetingSectionProps) {
	const [newMonth, setNewMonth, savingNewMonth] = useSavedSetting(newMonthDefault, (value) =>
		updateAllocationSettings({ newMonthDefault: value })
	);
	const [templateId, setTemplateId, savingTemplate] = useSavedSetting(defaultTemplateId ?? NO_TEMPLATE, (value) =>
		updateAllocationSettings({ defaultTemplateId: value === NO_TEMPLATE ? null : value })
	);

	return (
		<SettingsSection id="budgeting" title="Budgeting" note="How Allocations sets up a month without a budget.">
			<SettingRow
				label="New month"
				htmlFor="newMonthDefault"
				description="What happens when you open a month that has no budget yet."
			>
				<Select
					value={newMonth}
					onValueChange={(value) => setNewMonth(value as AllocationNewMonthDefault)}
					disabled={savingNewMonth}
				>
					<SelectTrigger id="newMonthDefault" className="w-full row-wide:w-64">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{NEW_MONTH_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingRow>

			<SettingRow
				label="Default template"
				htmlFor="defaultTemplate"
				description={
					templates.length === 0
						? "Save a month as a template in Allocations to choose one here."
						: "Used when a new month starts from a template."
				}
			>
				<Select value={templateId} onValueChange={setTemplateId} disabled={savingTemplate || templates.length === 0}>
					<SelectTrigger id="defaultTemplate" className="w-full row-wide:w-64">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NO_TEMPLATE}>None (the first one saved)</SelectItem>
						{sortAlphabetically(templates, (template) => template.name).map((template) => (
							<SelectItem key={template.id} value={template.id}>
								{template.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingRow>
		</SettingsSection>
	);
}
