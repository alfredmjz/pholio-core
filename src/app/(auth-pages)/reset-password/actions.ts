"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function resetPassword(formData: FormData) {
	const supabase = await createClient();
	const password = formData.get("password") as string;
	const confirmPassword = formData.get("confirmPassword") as string;

	if (password !== confirmPassword) {
		return { error: "Passwords do not match" };
	}

	const { error } = await supabase.auth.updateUser({
		password: password,
	});

	if (error) {
		return { error: error.message };
	}

	revalidatePath("/", "layout");
	redirect("/dashboard");
}
