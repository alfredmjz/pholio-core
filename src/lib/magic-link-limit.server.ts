import { createAdminClient } from "@/lib/supabase/server";
import { hashIdentifier, normalizeEmail, type MagicLinkLimitReason } from "@/lib/magic-link-limit";

export type MagicLinkClaim =
	| { allowed: true; sendId: number; retryAfterSeconds: number }
	| { allowed: false; retryAfterSeconds: number; reason: MagicLinkLimitReason };

type ClaimRow = {
	allowed: boolean;
	send_id: number | null;
	retry_after_seconds: number;
	reason: MagicLinkLimitReason | null;
};

/**
 * Checks the send limits and records the send in one database step (migration 020).
 * Runs with the admin client: the functions are closed to the browser roles. Throws when the
 * check can't run, and callers must then refuse to send (fail closed).
 */
export async function claimMagicLinkSend(email: string, ip: string): Promise<MagicLinkClaim> {
	const { data, error } = await createAdminClient()
		.rpc("claim_magic_link_send", {
			p_email_hash: hashIdentifier(normalizeEmail(email)),
			p_ip_hash: hashIdentifier(ip),
		})
		.single<ClaimRow>();

	if (error || !data) throw new Error(`Magic link limit check failed: ${error?.message ?? "no result"}`);

	if (data.allowed && data.send_id !== null) {
		return { allowed: true, sendId: data.send_id, retryAfterSeconds: data.retry_after_seconds };
	}
	return { allowed: false, retryAfterSeconds: data.retry_after_seconds, reason: data.reason ?? "cooldown" };
}

/** Supabase didn't send the email, so the claim shouldn't count against the user. */
export async function releaseMagicLinkSend(sendId: number): Promise<void> {
	const { error } = await createAdminClient().rpc("release_magic_link_send", { p_send_id: sendId });
	if (error) throw new Error(`Releasing magic link send failed: ${error.message}`);
}

/** The user signed in: links already sent stop counting toward the limit. */
export async function clearMagicLinkSends(email: string): Promise<void> {
	const { error } = await createAdminClient().rpc("clear_magic_link_sends", {
		p_email_hash: hashIdentifier(normalizeEmail(email)),
	});
	if (error) throw new Error(`Clearing magic link sends failed: ${error.message}`);
}
