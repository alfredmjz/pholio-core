import { SignJWT, jwtVerify } from "jose";
import { DEMO_COOKIE_MAX_AGE } from "@/lib/demo-mode";

/**
 * HttpOnly cookie holding the signed demo session. This is the authorization
 * credential for demo access: the cookie is only ever issued by the `startDemo`
 * server action, so a visitor cannot simply set the public
 * `PHOLIO_DEMO_EXPIRED_SESSION=1` cookie by hand.
 */
export const DEMO_SESSION_COOKIE = "pholio_demo_session";

const DEMO_AUDIENCE = "pholio-demo";

/**
 * Secret used to sign demo sessions. Prefer a dedicated secret; fall back to
 * the server-only Supabase secret so demo mode works without extra setup.
 * When neither is configured the demo is unavailable.
 */
function getSecret(): Uint8Array | null {
	const value = process.env.DEMO_SESSION_SECRET ?? process.env.SUPABASE_SECRET_KEY;
	return value ? new TextEncoder().encode(value) : null;
}

/**
 * Issues a short-lived signed demo session token.
 */
export async function createDemoSession(): Promise<string | null> {
	const secret = getSecret();
	if (!secret) return null;

	return new SignJWT({ demo: true })
		.setProtectedHeader({ alg: "HS256" })
		.setAudience(DEMO_AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(`${DEMO_COOKIE_MAX_AGE}s`)
		.sign(secret);
}

/**
 * Verifies a signed demo session token.
 */
export async function isValidDemoSession(token: string | undefined): Promise<boolean> {
	if (!token) return false;

	const secret = getSecret();
	if (!secret) return false;

	try {
		await jwtVerify(token, secret, { audience: DEMO_AUDIENCE });
		return true;
	} catch {
		return false;
	}
}
