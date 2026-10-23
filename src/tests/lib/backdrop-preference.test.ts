import { describe, expect, test } from "bun:test";
import { backdropCookie, parseBackdropPreference } from "@/lib/backdrop-preference";

describe("parseBackdropPreference", () => {
	test("keeps a known choice", () => {
		expect(parseBackdropPreference("none")).toBe("none");
		expect(parseBackdropPreference("wind")).toBe("wind");
		expect(parseBackdropPreference("adaptive")).toBe("adaptive");
	});

	test("falls back to adaptive when unset or unknown", () => {
		expect(parseBackdropPreference(undefined)).toBe("adaptive");
		expect(parseBackdropPreference(null)).toBe("adaptive");
		expect(parseBackdropPreference("rainy")).toBe("adaptive");
	});
});

test("the cookie lasts a year across the whole app", () => {
	expect(backdropCookie("wind")).toBe("pholio-backdrop=wind; path=/; max-age=31536000; samesite=lax");
});
