import { describe, expect, test } from "bun:test";
import { formatCountdown } from "@/lib/countdown";
import { getClientIp, hashIdentifier, limitMessage, normalizeEmail } from "@/lib/magic-link-limit";

function headersOf(values: Record<string, string>) {
	return new Headers(values);
}

describe("normalizeEmail", () => {
	test("trims and lower-cases so one inbox shares one limit", () => {
		expect(normalizeEmail("  Me@Example.COM ")).toBe("me@example.com");
	});
});

describe("hashIdentifier", () => {
	test("is the SHA-256 hex digest", () => {
		// echo -n "me@example.com" | sha256sum
		expect(hashIdentifier("me@example.com")).toBe("8c2a47d3bdb8d3096a6479f53eac3b724291db5f1c31611100f675be5537329d");
	});

	test("is stable and differs per input", () => {
		expect(hashIdentifier(normalizeEmail("ME@example.com"))).toBe(hashIdentifier("me@example.com"));
		expect(hashIdentifier("a@example.com")).not.toBe(hashIdentifier("b@example.com"));
	});
});

describe("getClientIp", () => {
	test("takes the first x-forwarded-for address (the client, not the proxies)", () => {
		expect(getClientIp(headersOf({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.7");
	});

	test("falls back to x-real-ip", () => {
		expect(getClientIp(headersOf({ "x-real-ip": " 198.51.100.4 " }))).toBe("198.51.100.4");
	});

	test("uses one shared bucket when no address is known", () => {
		expect(getClientIp(headersOf({}))).toBe("unknown");
		expect(getClientIp(headersOf({ "x-forwarded-for": " , " }))).toBe("unknown");
	});
});

describe("formatCountdown", () => {
	test("shows minutes and two-digit seconds", () => {
		expect(formatCountdown(60)).toBe("1:00");
		expect(formatCountdown(42)).toBe("0:42");
		expect(formatCountdown(9)).toBe("0:09");
		expect(formatCountdown(3540)).toBe("59:00");
	});

	test("rounds partial seconds up and never goes below zero", () => {
		expect(formatCountdown(41.2)).toBe("0:42");
		expect(formatCountdown(-5)).toBe("0:00");
	});
});

describe("limitMessage", () => {
	test("cooldown counts seconds", () => {
		expect(limitMessage("cooldown", 42)).toBe("Wait 42 seconds before asking for another link.");
		expect(limitMessage("cooldown", 1)).toBe("Wait 1 second before asking for another link.");
	});

	test("hourly limits round the wait up to whole minutes", () => {
		// 600 s = 10 min exactly; 601 s rounds up to 11 so the user never retries too early.
		expect(limitMessage("email_limit", 600)).toBe(
			"You've asked for 5 links in the last hour. Try again in 10 minutes."
		);
		expect(limitMessage("email_limit", 601)).toBe(
			"You've asked for 5 links in the last hour. Try again in 11 minutes."
		);
		expect(limitMessage("ip_limit", 30)).toBe("Too many sign-in links from this network. Try again in 1 minute.");
	});
});
