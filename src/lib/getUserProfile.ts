import { unstable_rethrow } from "next/navigation";
import { getReadContext } from "@/lib/data-context.server";
import { Logger } from "@/lib/logger";
import { profileStore } from "@/lib/profile-store";

export { getProfileRow, type UserProfile } from "@/lib/profile-store";

/** The authenticated user's profile, or null when nobody is signed in. */
export async function getUserProfile() {
	try {
		const ctx = await getReadContext();
		return ctx ? await profileStore(ctx).get() : null;
	} catch (error) {
		unstable_rethrow(error);
		Logger.error("Error fetching user profile", { error });
		return null;
	}
}
