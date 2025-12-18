import DataPrivacyCard from "../components/data-privacy-card";
import { SettingsContentWrapper } from "../components/settings-content-wrapper";

export default function DataPrivacyPage() {
	return (
		<SettingsContentWrapper title="Data & Privacy" description="Manage your data and privacy settings.">
			<DataPrivacyCard />
		</SettingsContentWrapper>
	);
}
