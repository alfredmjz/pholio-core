import { getAccounts } from "@/app/accounts/actions";
import { getAllocation, getAllocationSummary, getUserTemplates } from "@/app/allocations/actions";
import { SurfacePage } from "@/components/layout/surface-page";
import { getContributionRooms } from "@/lib/actions/contribution-actions";
import { requireAuth } from "@/lib/auth";
import { getTodayDateString } from "@/lib/date-utils";
import { isSampleDataMode } from "@/lib/demo-mode.server";
import { getAllocationSettings, getTimezone } from "./actions";
import { toUserPreferences } from "./preferences";
import { AppearanceSection } from "./components/appearance-section";
import { BudgetingSection } from "./components/budgeting-section";
import { ContributionRoomSection } from "./components/contribution-room-section";
import { DataSection } from "./components/data-section";
import { NotificationsSection } from "./components/notifications-section";
import { PresetsSection } from "./components/presets-section";
import { ProfileSection } from "./components/profile-section";
import { RegionSection } from "./components/region-section";
import { SettingsJumpList } from "./components/settings-jump-list";
import { SignInSection } from "./components/sign-in-section";

export const metadata = {
	title: "Settings | Pholio",
	description: "Your profile, preferences and data",
};

async function getPresetCategories(timezone: string | null) {
	const [year, month] = getTodayDateString(timezone ?? undefined)
		.split("-")
		.map(Number);
	const allocation = await getAllocation(year, month);
	const summary = allocation ? await getAllocationSummary(allocation.id) : null;
	return summary?.categories ?? [];
}

export default async function SettingsPage() {
	const { user, profile } = await requireAuth();
	const email = user.email ?? profile.email;
	const preferences = toUserPreferences(profile);

	const [allocationSettings, templates, timezone, rooms, accounts, isSampleData] = await Promise.all([
		getAllocationSettings(),
		getUserTemplates(),
		getTimezone(),
		getContributionRooms(),
		getAccounts(),
		isSampleDataMode(),
	]);
	const categories = await getPresetCategories(timezone);

	return (
		<SurfacePage className="max-w-[1080px]">
			<header>
				<h1 className="type-h2 text-primary">Settings</h1>
			</header>

			<div className="xl:grid xl:grid-cols-[180px_minmax(0,1fr)] xl:gap-10">
				<SettingsJumpList />
				<div className="flex min-w-0 flex-col gap-6">
					<ProfileSection profile={profile} email={email} />
					<SignInSection email={email} />
					<AppearanceSection />
					<BudgetingSection
						newMonthDefault={allocationSettings.newMonthDefault}
						defaultTemplateId={allocationSettings.defaultTemplateId}
						templates={templates}
					/>
					<ContributionRoomSection rooms={rooms} />
					<PresetsSection categories={categories} accounts={accounts} />
					<RegionSection timezone={timezone} currency={preferences.defaultCurrency} locale={preferences.locale} />
					<NotificationsSection
						email={email}
						notifyInApp={preferences.notifyInApp}
						notifyEmail={preferences.notifyEmail}
						leadDays={preferences.notifyLeadDays}
					/>
					<DataSection isSampleData={isSampleData} />
				</div>
			</div>
		</SurfacePage>
	);
}
