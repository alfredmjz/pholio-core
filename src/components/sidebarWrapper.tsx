import * as React from "react";
import { getUserProfile } from "@/lib/getUserProfile";
import { SideBarComponent } from "@/components/sidebar";

/**
 * Server component wrapper for the sidebar that fetches user data
 * This runs on the server and fetches data efficiently before rendering
 * Sidebar is always visible, even for guest users (with random name)
 */
export async function SidebarWrapper() {
	const userProfile = await getUserProfile();

	return <SideBarComponent userProfile={userProfile} />;
}
