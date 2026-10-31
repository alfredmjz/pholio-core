import type { SupabaseClient } from "@supabase/supabase-js";
import { statementLedgerSince, type StatementLedgerRow } from "@/lib/credit-card-statement";
import { getTodayDateString } from "@/lib/date-utils";
import { sendEmail } from "@/lib/email";
import { toFormatSettings, type FormatSettings } from "@/lib/format";
import { Logger } from "@/lib/logger";
import {
	buildReminderEmail,
	findDueReminders,
	type DueReminder,
	type ReminderCard,
	type ReminderRecurring,
} from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/server";

// Pholio is built around Canadian accounts, so a user who never picked a time zone gets Toronto's.
export const REMINDER_FALLBACK_TIMEZONE = "America/Toronto";
const KEEP_DAYS = 60;
const PAGE_SIZE = 1000;

export interface ReminderUser {
	id: string;
	email: string;
	timezone: string | null;
	locale: string | null;
	default_currency: string | null;
	notify_lead_days: number;
	notify_in_app?: boolean;
	notify_email?: boolean;
}

export interface ReminderItems {
	cards: ReminderCard[];
	recurring: ReminderRecurring[];
}

/** Active credit cards with a due day and active recurring items, grouped by user. */
export async function loadReminderItems(
	supabase: SupabaseClient,
	userIds: string[]
): Promise<Map<string, ReminderItems>> {
	const byUser = new Map<string, ReminderItems>(userIds.map((id) => [id, { cards: [], recurring: [] }]));
	if (userIds.length === 0) return byUser;

	const [cardsResult, recurringResult] = await Promise.all([
		supabase
			.from("accounts")
			.select(
				"id, user_id, name, institution, current_balance, payment_due_date, statement_day, account_types!inner(code)"
			)
			.in("user_id", userIds)
			.eq("is_active", true)
			.eq("account_types.code", "credit_card")
			.not("payment_due_date", "is", null),
		supabase
			.from("recurring_expenses")
			.select("id, user_id, name, amount, next_due_date, category")
			.in("user_id", userIds)
			.eq("is_active", true),
	]);

	if (cardsResult.error) throw cardsResult.error;
	if (recurringResult.error) throw recurringResult.error;

	const cards = cardsResult.data ?? [];
	const ledgers = await loadStatementLedgers(
		supabase,
		cards.map((row) => row.id)
	);
	for (const row of cards) {
		const institution = typeof row.institution === "string" ? row.institution.trim() : "";
		byUser.get(row.user_id)?.cards.push({
			id: row.id,
			name:
				institution && institution.toLowerCase() !== row.name.toLowerCase() ? `${institution} - ${row.name}` : row.name,
			balance: Number(row.current_balance),
			dueDay: Number(row.payment_due_date),
			statementDay: row.statement_day,
			ledger: ledgers.get(row.id),
		});
	}
	for (const row of recurringResult.data ?? []) {
		byUser.get(row.user_id)?.recurring.push({
			id: row.id,
			name: row.name,
			amount: Number(row.amount),
			nextDueDate: row.next_due_date,
			category: row.category,
		});
	}

	return byUser;
}

/** Each card's recent ledger rows, enough to work out its latest statement. */
async function loadStatementLedgers(
	supabase: SupabaseClient,
	cardIds: string[]
): Promise<Map<string, StatementLedgerRow[]>> {
	const byCard = new Map<string, StatementLedgerRow[]>(cardIds.map((id) => [id, []]));
	if (cardIds.length === 0) return byCard;

	const since = statementLedgerSince(new Date().toISOString().slice(0, 10));
	for (let from = 0; ; from += PAGE_SIZE) {
		const { data, error } = await supabase
			.from("account_transactions")
			.select("id, account_id, amount, transaction_date")
			.in("account_id", cardIds)
			.gte("transaction_date", since)
			.order("id")
			.range(from, from + PAGE_SIZE - 1);
		if (error) throw error;
		for (const row of data ?? []) {
			byCard.get(row.account_id)?.push({ amount: Number(row.amount), transaction_date: row.transaction_date });
		}
		if (!data || data.length < PAGE_SIZE) break;
	}
	return byCard;
}

export function remindersFor(user: ReminderUser, items: ReminderItems): { today: string; reminders: DueReminder[] } {
	const today = getTodayDateString(user.timezone || REMINDER_FALLBACK_TIMEZONE);
	return { today, reminders: findDueReminders({ today, leadDays: user.notify_lead_days, ...items }) };
}

export function formatSettingsFor(user: Pick<ReminderUser, "locale" | "default_currency">): FormatSettings {
	return toFormatSettings(user.locale, user.default_currency);
}

export function reminderLinks(appUrl: string) {
	return {
		app: `${appUrl}/dashboard`,
		settings: `${appUrl}/settings#notifications`,
		logo: `${appUrl}/pholio-icon.gif`,
		logoStill: `${appUrl}/pholio-icon.png`,
	};
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Adds the in-app reminders; the unique key makes a second run add nothing. */
async function addInAppReminders(supabase: AdminClient, userId: string, reminders: DueReminder[]): Promise<number> {
	const { data, error } = await supabase
		.from("notifications")
		.upsert(
			reminders.map((reminder) => ({
				user_id: userId,
				kind: reminder.kind,
				ref_id: reminder.refId,
				due_date: reminder.dueDate,
				name: reminder.name,
				detail: reminder.detail,
				amount: reminder.amount,
			})),
			{ onConflict: "user_id,kind,ref_id,due_date", ignoreDuplicates: true }
		)
		.select("id");
	if (error) throw error;
	return data?.length ?? 0;
}

/** Emails the reminders not emailed before. Claims them first, so overlapping runs can't both send. */
async function emailReminders(
	supabase: AdminClient,
	user: ReminderUser,
	reminders: DueReminder[],
	appUrl: string
): Promise<"sent" | "nothing_new" | "failed"> {
	const { data: claimed, error } = await supabase
		.from("notification_sends")
		.upsert(
			reminders.map((reminder) => ({
				user_id: user.id,
				kind: reminder.kind,
				ref_id: reminder.refId,
				due_date: reminder.dueDate,
			})),
			{ onConflict: "user_id,kind,ref_id,due_date", ignoreDuplicates: true }
		)
		.select("id, kind, ref_id, due_date");
	if (error) throw error;
	if (!claimed || claimed.length === 0) return "nothing_new";

	const claimedKeys = new Set(claimed.map((row) => `${row.kind}:${row.ref_id}:${row.due_date}`));
	const fresh = reminders.filter((reminder) =>
		claimedKeys.has(`${reminder.kind}:${reminder.refId}:${reminder.dueDate}`)
	);

	const result = await sendEmail({
		to: user.email,
		...buildReminderEmail(fresh, formatSettingsFor(user), reminderLinks(appUrl)),
	});
	if (result.sent) return "sent";

	// Not sent, so tomorrow's run tries these again.
	await supabase
		.from("notification_sends")
		.delete()
		.in(
			"id",
			claimed.map((row) => row.id)
		);
	return "failed";
}

/**
 * The daily cron job: for each user with reminders on, adds what's due within their lead days to
 * the bell, emails it, or both, once per item and due date. Uses the admin client, so only the
 * authorized cron route may import it.
 */
export async function sendDueReminders(
	appUrl: string
): Promise<{ users: number; inApp: number; emailed: number; failed: number }> {
	const supabase = createAdminClient();

	const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
	const [{ error: sendsError }, { error: notificationsError }] = await Promise.all([
		supabase.from("notification_sends").delete().lt("created_at", cutoff),
		supabase.from("notifications").delete().lt("created_at", cutoff),
	]);
	if (sendsError || notificationsError) {
		Logger.error("Could not prune old reminders", { error: sendsError ?? notificationsError });
	}

	const { data: users, error } = await supabase
		.from("users")
		.select("id, email, timezone, locale, default_currency, notify_lead_days, notify_in_app, notify_email")
		.or("notify_in_app.eq.true,notify_email.eq.true");
	if (error) throw error;
	if (!users || users.length === 0) return { users: 0, inApp: 0, emailed: 0, failed: 0 };

	const items = await loadReminderItems(
		supabase,
		users.map((user) => user.id)
	);

	let inApp = 0;
	let emailed = 0;
	let failed = 0;

	for (const user of users as ReminderUser[]) {
		try {
			const { reminders } = remindersFor(user, items.get(user.id) ?? { cards: [], recurring: [] });
			if (reminders.length === 0) continue;

			if (user.notify_in_app) inApp += await addInAppReminders(supabase, user.id, reminders);
			if (user.notify_email) {
				const outcome = await emailReminders(supabase, user, reminders, appUrl);
				if (outcome === "sent") emailed++;
				if (outcome === "failed") failed++;
			}
		} catch (userError) {
			failed++;
			Logger.error("Could not send reminders for a user", { error: userError, userId: user.id });
		}
	}

	return { users: users.length, inApp, emailed, failed };
}
