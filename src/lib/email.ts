import { Logger } from "@/lib/logger";

const RESEND_URL = "https://api.resend.com/emails";
// The local Supabase's inbox, where its sign-in emails land too (http://127.0.0.1:54324).
const MAILPIT_SEND_URL = "http://127.0.0.1:54324/api/v1/send";
// The sender verified in Resend for the sign-in emails (supabase/config.toml).
const FROM = { name: "Pholio", email: "noreply@pholio.ca" };
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface OutgoingEmail {
	to: string;
	subject: string;
	html: string;
	text: string;
}

export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "failed" };

/** Against the local Supabase, email without a Resend key goes to its Mailpit inbox instead. */
function usesLocalInbox(): boolean {
	if (process.env.RESEND_API_KEY) return false;
	try {
		return LOCAL_HOSTS.has(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname);
	} catch {
		return false;
	}
}

export function isEmailConfigured(): boolean {
	return Boolean(process.env.RESEND_API_KEY) || usesLocalInbox();
}

/** Why email can't be sent, worded for whoever can fix it. */
export function emailNotConfiguredMessage(): string {
	return process.env.NODE_ENV === "production"
		? "Email isn't set up on this server yet."
		: "Email isn't set up: add RESEND_API_KEY to src/.env.local, or use the local Supabase, whose emails land in Mailpit.";
}

async function post(url: string, init: RequestInit, label: string): Promise<SendResult> {
	try {
		const response = await fetch(url, init);
		if (!response.ok) {
			Logger.error(`${label} rejected an email`, { status: response.status, body: await response.text() });
			return { sent: false, reason: "failed" };
		}
		return { sent: true };
	} catch (error) {
		Logger.error(`Could not reach ${label}`, { error });
		return { sent: false, reason: "failed" };
	}
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
	const apiKey = process.env.RESEND_API_KEY;

	if (apiKey) {
		return post(
			RESEND_URL,
			{
				method: "POST",
				headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
				body: JSON.stringify({
					from: `${FROM.name} <${FROM.email}>`,
					to: [email.to],
					subject: email.subject,
					html: email.html,
					text: email.text,
				}),
			},
			"Resend"
		);
	}

	if (usesLocalInbox()) {
		return post(
			MAILPIT_SEND_URL,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					From: { Email: FROM.email, Name: FROM.name },
					To: [{ Email: email.to }],
					Subject: email.subject,
					HTML: email.html,
					Text: email.text,
				}),
			},
			"Mailpit"
		);
	}

	Logger.warn("RESEND_API_KEY is not set; email not sent", { subject: email.subject });
	return { sent: false, reason: "not_configured" };
}
