import { afterEach, describe, expect, mock, test } from "bun:test";
import { emailNotConfiguredMessage, isEmailConfigured, sendEmail } from "@/lib/email";

const env = { ...process.env };
const realFetch = globalThis.fetch;
const email = { to: "me@pholio.test", subject: "Hi", html: "<p>Hi</p>", text: "Hi" };

function setEnv(values: Record<string, string | undefined>) {
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
}

afterEach(() => {
	process.env = { ...env };
	globalThis.fetch = realFetch;
});

describe("where email goes", () => {
	test("Resend when a key is set", async () => {
		setEnv({ RESEND_API_KEY: "re_test", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" });
		const fetchMock = mock(async () => new Response("{}", { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		expect(await sendEmail(email)).toEqual({ sent: true });
		expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://api.resend.com/emails");
	});

	test("the local Supabase's Mailpit inbox when there's no key", async () => {
		setEnv({ RESEND_API_KEY: undefined, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" });
		const fetchMock = mock(async () => new Response("{}", { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		expect(isEmailConfigured()).toBe(true);
		expect(await sendEmail(email)).toEqual({ sent: true });
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("http://127.0.0.1:54324/api/v1/send");
		expect(JSON.parse(String(init.body))).toMatchObject({ To: [{ Email: "me@pholio.test" }], Subject: "Hi" });
	});

	test("nowhere against a hosted Supabase without a key", async () => {
		setEnv({ RESEND_API_KEY: undefined, NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" });
		const fetchMock = mock(async () => new Response("{}", { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		expect(isEmailConfigured()).toBe(false);
		expect(await sendEmail(email)).toEqual({ sent: false, reason: "not_configured" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("a rejected send is reported as failed", async () => {
		setEnv({ RESEND_API_KEY: "re_test" });
		globalThis.fetch = mock(async () => new Response("bad sender", { status: 403 })) as unknown as typeof fetch;
		expect(await sendEmail(email)).toEqual({ sent: false, reason: "failed" });
	});
});

test("the setup message tells a developer what to add, and users only that it's not set up", () => {
	setEnv({ NODE_ENV: "development" });
	expect(emailNotConfiguredMessage()).toContain("RESEND_API_KEY");
	setEnv({ NODE_ENV: "production" });
	expect(emailNotConfiguredMessage()).toBe("Email isn't set up on this server yet.");
});
