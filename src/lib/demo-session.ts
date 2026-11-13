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
		.setJti(crypto.randomUUID())
		.setIssuedAt()
		.setExpirationTime(`${DEMO_COOKIE_MAX_AGE}s`)
		.sign(secret);
}

/**
 * Verifies a signed demo session token and returns its id, which keys that visitor's demo
 * state. Tokens issued before ids existed share one "legacy" id until they expire.
 */
export async function getDemoSessionId(token: string | undefined): Promise<string | null> {
	if (!token) return null;

	const secret = getSecret();
	if (!secret) return null;

	try {
		const { payload } = await jwtVerify(token, secret, { audience: DEMO_AUDIENCE });
		return payload.jti ?? "legacy";
	} catch {
		return null;
	}
}

/**
 * Verifies a signed demo session token.
 */
export async function isValidDemoSession(token: string | undefined): Promise<boolean> {
	return (await getDemoSessionId(token)) !== null;
}
