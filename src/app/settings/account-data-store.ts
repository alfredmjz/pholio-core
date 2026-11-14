import { ActionError } from "@/lib/action-result";
import type { DataContext, SupabaseContext } from "@/lib/data-context.server";
import { getTodayDateString } from "@/lib/date-utils";
import { emailNotConfiguredMessage, isEmailConfigured, sendEmail } from "@/lib/email";
import { Logger } from "@/lib/logger";
import { buildReminderEmail, type DueReminder } from "@/lib/reminders";
import {
	formatSettingsFor,
	loadReminderItems,
	reminderLinks,
	remindersFor,
	type ReminderUser,
} from "@/lib/reminder-jobs";
import { createAdminClient } from "@/lib/supabase/server";
import { buildFullExportCsv, EXPORT_KINDS, EXPORT_QUERIES, exportFilename, type ExportKind } from "./data-export";

const TEST_EMAILS_PER_DAY = 5;
const EXPORT_PAGE_SIZE = 1000;

/** Sign-in, picture, reminder emails and whole-account data: things that only exist for a real signed-in user. */
export interface AccountDataStore {
	/** Supabase sends the confirmation email; resolves once it is on its way. */
	changeEmail(newEmail: string): Promise<void>;
	uploadAvatar(file: File): Promise<void>;
	/** Emails the user what a reminder would hold right now; returns the sentence to show. */
	sendTestReminder(origin: string): Promise<string>;
	exportAll(): Promise<{ filename: string; csv: string }>;
	resetAll(): Promise<void>;
	deleteAccount(): Promise<void>;
}

export function accountDataStore(ctx: DataContext): AccountDataStore {
	return ctx.kind === "demo" ? demoAccountDataStore() : supabaseAccountDataStore(ctx);
}

function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function supabaseAccountDataStore({ db, userId }: SupabaseContext): AccountDataStore {
	return {
		async changeEmail(newEmail) {
			const { data } = await db.auth.getUser();
			if (newEmail === data.user?.email) {
				throw new ActionError("invalid_input", "New email must be different from current email");
			}

			const { error } = await db.auth.updateUser({ email: newEmail });
			if (error) {
				Logger.error("Email update error", { error });
				if (error.message.includes("already registered")) {
					throw new ActionError("invalid_input", "This email is already registered");
				}
				throw new ActionError("failed", error.message || "Failed to update email");
			}
		},

		async uploadAvatar(file) {
			const filePath = `${userId}/${Date.now()}-avatar.png`;

			const { error: uploadError } = await db.storage.from("avatars").upload(filePath, file, {
				contentType: file.type,
				upsert: false,
			});
			if (uploadError) {
				Logger.error("Storage upload error", { error: uploadError });
				throw new ActionError("failed", "Failed to upload image. ensure the 'avatars' bucket exists and is public.");
			}

			const {
				data: { publicUrl },
			} = db.storage.from("avatars").getPublicUrl(filePath);

			const { error: updateError } = await db
				.from("users")
				.update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
				.eq("id", userId);
			if (updateError) {
				Logger.error("Profile avatar update error", { error: updateError });
				throw new ActionError("failed", "Failed to update profile with new image");
			}
		},

		async sendTestReminder(origin) {
			if (!isEmailConfigured()) throw new ActionError("failed", emailNotConfiguredMessage());

			const { data: profile, error: profileError } = await db
				.from("users")
				.select("id, email, timezone, locale, default_currency, notify_lead_days")
				.eq("id", userId)
				.single();
			if (profileError || !profile) throw new ActionError("failed", "Couldn't load your settings");

			const reminderUser = profile as ReminderUser;
			const items = await loadReminderItems(db, [userId]);
			const { today, reminders } = remindersFor(reminderUser, items.get(userId) ?? { cards: [], recurring: [] });

			// The send log is service-role only; every query here is scoped to this user's id.
			const admin = createAdminClient();
			const { count } = await admin
				.from("notification_sends")
				.select("id", { count: "exact", head: true })
				.eq("user_id", userId)
				.eq("kind", "test")
				.eq("due_date", today);
			if ((count ?? 0) >= TEST_EMAILS_PER_DAY) {
				throw new ActionError("failed", `You've sent ${TEST_EMAILS_PER_DAY} test emails today. Try again tomorrow.`);
			}

			const { data: logged, error: logError } = await admin
				.from("notification_sends")
				.insert({ user_id: userId, kind: "test", ref_id: crypto.randomUUID(), due_date: today })
				.select("id")
				.single();
			if (logError || !logged) {
				Logger.error("Could not log a test reminder", { error: logError });
				throw new ActionError("failed", "Couldn't send the test email");
			}

			const example: DueReminder = {
				kind: "recurring_due",
				refId: "example",
				name: "Example: phone bill",
				dueDate: today,
				daysUntil: reminderUser.notify_lead_days,
				amount: 65,
				detail: "Bill",
			};
			const email = buildReminderEmail(
				reminders.length > 0 ? reminders : [{ ...example, dueDate: addDays(today, reminderUser.notify_lead_days) }],
				formatSettingsFor(reminderUser),
				reminderLinks(origin)
			);
			const result = await sendEmail({ to: profile.email, ...email, subject: `Test: ${email.subject}` });

			if (!result.sent) {
				await admin.from("notification_sends").delete().eq("id", logged.id);
				throw new ActionError("failed", "Couldn't send the test email. Try again in a minute.");
			}

			return reminders.length > 0
				? `Sent to ${profile.email} with what's due now.`
				: `Sent to ${profile.email} with an example, since nothing is due soon.`;
		},

		async exportAll() {
			const readAll = async (kind: ExportKind): Promise<Record<string, unknown>[]> => {
				const query = EXPORT_QUERIES[kind];
				const rows: Record<string, unknown>[] = [];
				for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
					const { data, error } = await db
						.from(query.table)
						.select(query.select)
						.eq("user_id", userId)
						.order(query.order, { ascending: false })
						.order("id", { ascending: true })
						.range(from, from + EXPORT_PAGE_SIZE - 1);
					if (error) throw error;
					rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
					if (!data || data.length < EXPORT_PAGE_SIZE) return rows;
				}
			};

			try {
				const [accounts, accountTransactions, budgetTransactions, recurring] = await Promise.all(
					EXPORT_KINDS.map(readAll)
				);
				return {
					filename: exportFilename(getTodayDateString()),
					csv: buildFullExportCsv({
						accounts,
						account_transactions: accountTransactions,
						budget_transactions: budgetTransactions,
						recurring,
					}),
				};
			} catch (error) {
				Logger.error("Error exporting data", { error });
				throw new ActionError("failed", "Couldn't read your data. Try again.");
			}
		},

		async resetAll() {
			const { error } = await db.rpc("reset_my_data");
			if (error) {
				Logger.error("Could not reset data", { error });
				throw new ActionError("failed", "Couldn't reset your data. Nothing was removed.");
			}
			Logger.info("User reset their data", { userId });
		},

		async deleteAccount() {
			// Only this user's own id is ever deleted; the admin client is needed for the login itself.
			const admin = createAdminClient();

			const { data: files, error: listError } = await admin.storage.from("avatars").list(userId, { limit: 1000 });
			if (listError) {
				Logger.error("Could not list avatar files for account deletion", { error: listError });
				throw new ActionError("failed", "Couldn't delete your account. Nothing was removed.");
			}
			if (files && files.length > 0) {
				const { error: removeError } = await admin.storage
					.from("avatars")
					.remove(files.map((file) => `${userId}/${file.name}`));
				if (removeError) {
					Logger.error("Could not remove avatar files for account deletion", { error: removeError });
					throw new ActionError("failed", "Couldn't delete your account. Nothing was removed.");
				}
			}

			const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
			if (deleteError) {
				Logger.error("Could not delete user", { error: deleteError });
				// The picture is gone already, so don't leave a broken link to it.
				await db.from("users").update({ avatar_url: null }).eq("id", userId);
				throw new ActionError("failed", "Couldn't delete your account. Try again.");
			}

			// The session belongs to a deleted user now; clearing the cookies may fail and that's fine.
			await db.auth.signOut().catch(() => undefined);
			Logger.info("User deleted their account", { userId });
		},
	};
}

function demoAccountDataStore(): AccountDataStore {
	const refuse = (message: string) => async (): Promise<never> => {
		throw new ActionError("failed", message);
	};
	return {
		changeEmail: refuse("Sample data: the sign-in email can't be changed."),
		uploadAvatar: refuse("Cannot upload avatar in demo mode"),
		sendTestReminder: refuse("Sample data: no email sent."),
		exportAll: refuse("Exports are for your own data, not the sample data."),
		resetAll: refuse("The sample data can't be reset."),
		deleteAccount: refuse("The sample account can't be deleted."),
	};
}
