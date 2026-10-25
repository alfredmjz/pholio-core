import { describe, expect, test } from "bun:test";
import { withoutUnknownParams } from "@/lib/page-params";

const strip = (pathname: string, query: string) =>
	withoutUnknownParams(pathname, new URLSearchParams(query))?.toString();

describe("withoutUnknownParams", () => {
	test("drops a parameter the page does not read", () => {
		expect(strip("/dashboard", "weather=rainy")).toBe("");
		expect(strip("/dashboard", "welcome=true")).toBe("");
		expect(strip("/accounts/abc-123", "weather=rainy")).toBe("");
		expect(strip("/settings/preferences", "tab=x")).toBe("");
	});

	test("keeps the ones it does read", () => {
		expect(strip("/allocations", "year=2026&month=10&weather=rainy")).toBe("year=2026&month=10");
	});

	test("leaves a clean URL alone", () => {
		expect(strip("/allocations", "year=2026&month=10")).toBeUndefined();
		expect(strip("/dashboard", "")).toBeUndefined();
	});

	test("leaves pages outside the signed-in sections alone", () => {
		expect(strip("/login", "weather=rainy")).toBeUndefined();
		expect(strip("/auth/callback", "code=abc&next=/dashboard")).toBeUndefined();
		expect(strip("/api/logos/search", "q=netflix")).toBeUndefined();
		expect(strip("/dashboards", "weather=rainy")).toBeUndefined();
	});
});
