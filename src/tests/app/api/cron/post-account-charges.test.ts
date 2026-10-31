import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

type CronRoute = typeof import("@/app/api/cron/post-account-charges/route");

const postDueAccountCharges = mock(async () => ({ success: true, posted: 2 }));
mock.module("@/lib/account-charges-job", () => ({ postDueAccountCharges }));

let GET: CronRoute["GET"];

beforeAll(async () => {
	// Import after mocking so the route picks up the stubbed job.
	({ GET } = await import("@/app/api/cron/post-account-charges/route"));
});

function cronRequest(authorization?: string) {
	return new Request("http://localhost/api/cron/post-account-charges", {
		headers: authorization ? { authorization } : {},
	});
}

describe("account charges cron route", () => {
	const originalSecret = process.env.CRON_SECRET;
	const originalSample = process.env.NEXT_PUBLIC_USE_SAMPLE_DATA;

	beforeEach(() => {
		postDueAccountCharges.mockClear();
		delete process.env.NEXT_PUBLIC_USE_SAMPLE_DATA;
	});

	afterEach(() => {
		if (originalSecret === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = originalSecret;
		if (originalSample === undefined) delete process.env.NEXT_PUBLIC_USE_SAMPLE_DATA;
		else process.env.NEXT_PUBLIC_USE_SAMPLE_DATA = originalSample;
	});

	test("refuses to run when CRON_SECRET is not set", async () => {
		delete process.env.CRON_SECRET;

		expect((await GET(cronRequest("Bearer anything"))).status).toBe(500);
		expect(postDueAccountCharges).not.toHaveBeenCalled();
	});

	test("rejects a missing or wrong authorization header", async () => {
		process.env.CRON_SECRET = "test-cron-secret";

		expect((await GET(cronRequest())).status).toBe(401);
		expect((await GET(cronRequest("Bearer wrong-secret"))).status).toBe(401);
		expect(postDueAccountCharges).not.toHaveBeenCalled();
	});

	test("runs once with the matching secret", async () => {
		process.env.CRON_SECRET = "test-cron-secret";

		const response = await GET(cronRequest("Bearer test-cron-secret"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "Success", posted: 2 });
		expect(postDueAccountCharges).toHaveBeenCalledTimes(1);
	});
});
