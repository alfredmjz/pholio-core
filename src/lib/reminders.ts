import { formatDateParts, formatMoney, type FormatSettings } from "@/lib/format";

export type ReminderKind = "card_due" | "recurring_due";

export interface ReminderCard {
	id: string;
	name: string;
	/** What's owed; positive for a liability. */
	balance: number;
	/** Day of the month the payment is due, 1–31. */
	dueDay: number;
}

export interface ReminderRecurring {
	id: string;
	name: string;
	amount: number;
	nextDueDate: string;
	category: "bill" | "subscription";
}

export interface DueReminder {
	kind: ReminderKind;
	refId: string;
	name: string;
	dueDate: string;
	daysUntil: number;
	amount: number;
	detail: string;
}

const MS_PER_DAY = 86_400_000;

function toUtcDay(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return Date.UTC(y, m - 1, d);
}

function toDateString(utcMs: number): string {
	return new Date(utcMs).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
	return Math.round((toUtcDay(to) - toUtcDay(from)) / MS_PER_DAY);
}

/** The next date a card's due day falls on, from today; short months clamp to their last day. */
export function nextCardDueDate(dueDay: number, today: string): string {
	const [y, m, d] = today.split("-").map(Number);
	const onDay = (year: number, monthIndex: number) => {
		const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
		return Date.UTC(year, monthIndex, Math.min(dueDay, lastDay));
	};
	const thisMonth = onDay(y, m - 1);
	return toDateString(thisMonth >= Date.UTC(y, m - 1, d) ? thisMonth : onDay(y, m));
}

/** Everything due from today up to `leadDays` days ahead, soonest first. */
export function findDueReminders({
	today,
	leadDays,
	cards,
	recurring,
}: {
	today: string;
	leadDays: number;
	cards: ReminderCard[];
	recurring: ReminderRecurring[];
}): DueReminder[] {
	const reminders: DueReminder[] = [];

	for (const card of cards) {
		if (!Number.isInteger(card.dueDay) || card.dueDay < 1 || card.dueDay > 31) continue;
		// Nothing owed, nothing to pay.
		if (card.balance <= 0) continue;
		const dueDate = nextCardDueDate(card.dueDay, today);
		const daysUntil = daysBetween(today, dueDate);
		if (daysUntil > leadDays) continue;
		reminders.push({
			kind: "card_due",
			refId: card.id,
			name: card.name,
			dueDate,
			daysUntil,
			amount: card.balance,
			detail: "Credit card payment",
		});
	}

	for (const item of recurring) {
		const daysUntil = daysBetween(today, item.nextDueDate);
		if (daysUntil < 0 || daysUntil > leadDays) continue;
		reminders.push({
			kind: "recurring_due",
			refId: item.id,
			name: item.name,
			dueDate: item.nextDueDate,
			daysUntil,
			amount: item.amount,
			detail: item.category === "bill" ? "Bill" : "Subscription renewal",
		});
	}

	return reminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}

function whenLabel(reminder: DueReminder, settings: FormatSettings): string {
	if (reminder.daysUntil === 0) return "today";
	if (reminder.daysUntil === 1) return "tomorrow";
	const date = new Date(toUtcDay(reminder.dueDate));
	return formatDateParts(date, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }, settings.locale);
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ReminderEmail {
	subject: string;
	text: string;
	html: string;
}

export function buildReminderEmail(
	reminders: DueReminder[],
	settings: FormatSettings,
	links: { app: string; settings: string; logo: string; logoStill: string }
): ReminderEmail {
	const lines = reminders.map((reminder) => {
		const amount = formatMoney(reminder.amount, {
			showCents: true,
			currency: settings.currency,
			locale: settings.locale,
		});
		return { reminder, amount, when: whenLabel(reminder, settings) };
	});

	const count = reminders.length;
	const subject =
		count === 1 ? `${reminders[0].name} is due ${lines[0].when}` : `${count} payments coming up in Pholio`;

	const text = [
		"Coming up in Pholio:",
		"",
		...lines.map(({ reminder, amount, when }) => `- ${reminder.name}: ${amount}, due ${when} (${reminder.detail})`),
		"",
		`Open Pholio: ${links.app}`,
		`Change or turn off reminders: ${links.settings}`,
	].join("\n");

	const rows = lines
		.map(
			({ reminder, amount, when }) => `
			<tr>
				<td style="padding:10px 0;border-bottom:1px solid #e7e1d6;">
					<div style="font-weight:600;color:#2c2822;">${escapeHtml(reminder.name)}</div>
					<div style="font-size:13px;color:#6f675c;">${escapeHtml(reminder.detail)}, due ${escapeHtml(when)}</div>
				</td>
				<td style="padding:10px 0;border-bottom:1px solid #e7e1d6;text-align:right;font-weight:600;color:#2c2822;white-space:nowrap;">${escapeHtml(amount)}</td>
			</tr>`
		)
		.join("");

	const html = `<!doctype html>
<html>
	<body style="margin:0;padding:24px;background:#f6f2ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
		<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #e7e1d6;border-radius:16px;padding:24px;">
			<tr><td>
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">
					<tr>
						<td valign="middle" style="padding-right:10px;">
							<!-- Classic Outlook for Windows can't animate a GIF, so it gets the still PNG. -->
							<!--[if mso]><img src="${escapeHtml(links.logoStill)}" alt="" width="28" height="28" style="display:block;border:0;" /><![endif]-->
							<!--[if !mso]><!--><img src="${escapeHtml(links.logo)}" alt="" width="28" height="28" style="display:block;width:28px;height:28px;border:0;border-radius:7px;" /><!--<![endif]-->
						</td>
						<td valign="middle" style="font-size:17px;font-weight:600;letter-spacing:-0.02em;color:#2c2822;">Pholio</td>
					</tr>
				</table>
				<p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#2c2822;">Coming up</p>
				<p style="margin:0 0 16px;font-size:14px;color:#6f675c;">${count === 1 ? "One payment is" : `${count} payments are`} due soon.</p>
				<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">${rows}</table>
				<p style="margin:20px 0 0;"><a href="${escapeHtml(links.app)}" style="display:inline-block;background:#0f6b50;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:999px;font-size:14px;">Open Pholio</a></p>
				<p style="margin:16px 0 0;font-size:12px;color:#8a8275;"><a href="${escapeHtml(links.settings)}" style="color:#8a8275;">Change or turn off these reminders</a></p>
			</td></tr>
		</table>
	</body>
</html>`;

	return { subject, text, html };
}
