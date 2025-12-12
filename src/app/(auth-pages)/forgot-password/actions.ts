"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function forgotPassword(formData: FormData) {
	const supabase = await createClient();
	const email = formData.get("email") as string;
	const origin = (await headers()).get("origin");

	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${origin}/auth/callback?next=/reset-password`,
	});

	if (error) {
		return { error: error.message };
	}

	return { success: "Password reset link sent to your email." };
}
