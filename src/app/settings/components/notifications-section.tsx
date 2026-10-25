"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { sendTestReminder, updatePreferences } from "../actions";
import { REMINDER_LEAD_DAYS } from "../preferences";
import { SegmentedChoice } from "@/components/common/segmented-choice";
import { SettingRow, SettingsSection } from "./settings-section";
import { useSavedSetting } from "./use-saved-setting";

// Natural order: fewest days first.
const LEAD_DAY_OPTIONS = REMINDER_LEAD_DAYS.map((days) => ({
	value: String(days),
	label: days === 1 ? "1 day" : `${days} days`,
}));

interface NotificationsSectionProps {
	email: string;
	notifyInApp: boolean;
	notifyEmail: boolean;
	leadDays: number;
}

export function NotificationsSection({ email, notifyInApp, notifyEmail, leadDays }: NotificationsSectionProps) {
	const [inApp, setInApp, savingInApp] = useSavedSetting(notifyInApp, (value) =>
		updatePreferences({ notifyInApp: value })
	);
	const [byEmail, setByEmail, savingEmail] = useSavedSetting(notifyEmail, (value) =>
		updatePreferences({ notifyEmail: value })
	);
	const enabled = inApp || byEmail;
	const [days, setDays, savingDays] = useSavedSetting(String(leadDays), (value) =>
		updatePreferences({ notifyLeadDays: Number(value) })
	);
	const [isSending, startSending] = useTransition();

	const sendTest = () =>
		startSending(async () => {
			const result = await sendTestReminder();
			if (result.success) {
				toast.success("Test email sent", { description: result.message });
			} else {
				toast.error("Couldn't send the test email", { description: result.error });
			}
		});

	return (
		<SettingsSection
			id="notifications"
			title="Notifications"
			note="Reminders before a credit card payment, bill or subscription is due. Turn both off for none."
		>
			<SettingRow
				label="In Pholio"
				htmlFor="notifyInApp"
				description="Shown under the bell, with a dot until you've seen them."
			>
				<Switch id="notifyInApp" checked={inApp} onCheckedChange={setInApp} disabled={savingInApp} />
			</SettingRow>

			<SettingRow
				label="By email"
				htmlFor="notifyEmail"
				description={
					<>
						Sent to <span className="text-primary">{email}</span>.
					</>
				}
			>
				<Switch id="notifyEmail" checked={byEmail} onCheckedChange={setByEmail} disabled={savingEmail} />
			</SettingRow>

			<SettingRow
				label="Remind me"
				description={enabled ? "How long before the due date." : "Turn on In Pholio or By email to choose."}
			>
				<SegmentedChoice
					label="Days before the due date"
					value={days}
					options={LEAD_DAY_OPTIONS}
					onChange={setDays}
					disabled={!enabled || savingDays}
				/>
			</SettingRow>

			<SettingRow label="Test email" description="Sends what's due now, or an example when nothing is.">
				<Button variant="outline" onClick={sendTest} disabled={isSending} className="w-full row-wide:w-auto">
					{isSending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
					Send a test email
				</Button>
			</SettingRow>
		</SettingsSection>
	);
}
