import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

type CronRoute = typeof import("@/app/api/cron/send-reminders/route");

const sendDueReminders = mock(async (_appUrl: string) => ({ users: 2, emailed: 1, failed: 0 }));
mock.module("@/lib/reminder-jobs", () => ({ sendDueReminders }));

let GET: CronRoute["GET"];

beforeAll(async () => {
	// Import after mocking so the route picks up the stubbed job.
	({ GET } = await import("@/app/api/cron/send-reminders/route"));
});

function cronRequest(authorization?: string) {
	return new Request("https://pholio.test/api/cron/send-reminders", {
		headers: authorization ? { authorization } : {},
	});
}

describe("reminder email cron route", () => {
	const originalSecret = process.env.CRON_SECRET;
	const originalSampleData = process.env.NEXT_PUBLIC_USE_SAMPLE_DATA;

	beforeEach(() => {
		sendDueReminders.mockClear();
		delete process.env.NEXT_PUBLIC_USE_SAMPLE_DATA;
	});

	afterEach(() => {
		if (originalSecret === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = originalSecret;
		if (originalSampleData === undefined) delete process.env.NEXT_PUBLIC_USE_SAMPLE_DATA;
		else process.env.NEXT_PUBLIC_USE_SAMPLE_DATA = originalSampleData;
	});

	test("refuses to run when CRON_SECRET is not set", async () => {
		delete process.env.CRON_SECRET;
		expect((await GET(cronRequest("Bearer anything"))).status).toBe(500);
		expect(sendDueReminders).not.toHaveBeenCalled();
	});

	test("rejects a missing or wrong authorization header", async () => {
		process.env.CRON_SECRET = "test-cron-secret";
		expect((await GET(cronRequest())).status).toBe(401);
		expect((await GET(cronRequest("Bearer wrong-secret"))).status).toBe(401);
		expect(sendDueReminders).not.toHaveBeenCalled();
	});

	test("sends once with the matching secret, linking back to the same site", async () => {
		process.env.CRON_SECRET = "test-cron-secret";
		const response = await GET(cronRequest("Bearer test-cron-secret"));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "Success", users: 2, emailed: 1, failed: 0 });
		expect(sendDueReminders).toHaveBeenCalledTimes(1);
		expect(sendDueReminders).toHaveBeenCalledWith("https://pholio.test");
	});

	test("sends nothing in sample data mode", async () => {
		process.env.CRON_SECRET = "test-cron-secret";
		process.env.NEXT_PUBLIC_USE_SAMPLE_DATA = "true";
		const response = await GET(cronRequest("Bearer test-cron-secret"));
		expect(response.status).toBe(200);
		expect(sendDueReminders).not.toHaveBeenCalled();
	});
});
