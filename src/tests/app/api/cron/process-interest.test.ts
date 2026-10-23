import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

type CronRoute = typeof import("@/app/api/cron/process-interest/route");

const processGlobalMonthlyInterest = mock(async () => ({ success: true, processed: 3 }));
mock.module("@/lib/monthly-interest", () => ({ processGlobalMonthlyInterest }));

let GET: CronRoute["GET"];

beforeAll(async () => {
	// Import after mocking so the route picks up the stubbed interest job.
	({ GET } = await import("@/app/api/cron/process-interest/route"));
});

function cronRequest(authorization?: string) {
	return new Request("http://localhost/api/cron/process-interest", {
		headers: authorization ? { authorization } : {},
	});
}

describe("monthly interest cron route", () => {
	const originalSecret = process.env.CRON_SECRET;

	beforeEach(() => {
		processGlobalMonthlyInterest.mockClear();
	});

	afterEach(() => {
		if (originalSecret === undefined) delete process.env.CRON_SECRET;
		else process.env.CRON_SECRET = originalSecret;
	});

	test("refuses to run when CRON_SECRET is not set", async () => {
		delete process.env.CRON_SECRET;

		const response = await GET(cronRequest("Bearer anything"));

		expect(response.status).toBe(500);
		expect(processGlobalMonthlyInterest).not.toHaveBeenCalled();
	});

	test("rejects a missing or wrong authorization header", async () => {
		process.env.CRON_SECRET = "test-cron-secret";

		expect((await GET(cronRequest())).status).toBe(401);
		expect((await GET(cronRequest("Bearer wrong-secret"))).status).toBe(401);
		expect(processGlobalMonthlyInterest).not.toHaveBeenCalled();
	});

	test("runs once with the matching secret", async () => {
		process.env.CRON_SECRET = "test-cron-secret";

		const response = await GET(cronRequest("Bearer test-cron-secret"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "Success", processed: 3 });
		expect(processGlobalMonthlyInterest).toHaveBeenCalledTimes(1);
	});
});
