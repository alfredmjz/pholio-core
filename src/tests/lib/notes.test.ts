import { describe, expect, test } from "bun:test";
import { isNotesEmpty, notesToHtml } from "@/lib/notes";

describe("notesToHtml", () => {
	test("empty and missing notes become an empty string", () => {
		expect(notesToHtml(null)).toBe("");
		expect(notesToHtml(undefined)).toBe("");
		expect(notesToHtml("")).toBe("");
	});

	test("rich-text notes pass through unchanged", () => {
		const html = "<h2>Plan</h2><p>Pay in <strong>full</strong></p><ul><li><p>Milk</p></li></ul>";
		expect(notesToHtml(html)).toBe(html);
	});

	test("plain text becomes one paragraph per line", () => {
		expect(notesToHtml("Pay in full each month\nCall the bank in May")).toBe(
			"<p>Pay in full each month</p><p>Call the bank in May</p>"
		);
	});

	test("dash lines become a bullet list and numbered lines a numbered list", () => {
		expect(notesToHtml("Todo\n- Milk\n- Eggs\n1. First\n2. Second")).toBe(
			"<p>Todo</p><ul><li><p>Milk</p></li><li><p>Eggs</p></li></ul><ol><li><p>First</p></li><li><p>Second</p></li></ol>"
		);
	});

	test("blank lines stay as empty paragraphs", () => {
		expect(notesToHtml("One\n\nTwo")).toBe("<p>One</p><p></p><p>Two</p>");
	});

	test("plain text is escaped, so it can never become markup", () => {
		expect(notesToHtml('Limit < 5000 & "high" > low <img onerror=x>')).toBe(
			"<p>Limit &lt; 5000 &amp; &quot;high&quot; &gt; low &lt;img onerror=x&gt;</p>"
		);
	});
});

describe("isNotesEmpty", () => {
	test("nothing, whitespace and empty paragraphs count as empty", () => {
		expect(isNotesEmpty(null)).toBe(true);
		expect(isNotesEmpty("   ")).toBe(true);
		expect(isNotesEmpty("<p></p>")).toBe(true);
		expect(isNotesEmpty("<p> </p><p>&nbsp;</p><ul><li><p></p></li></ul>")).toBe(true);
	});

	test("any written text counts as notes", () => {
		expect(isNotesEmpty("<p>Hi</p>")).toBe(false);
		expect(isNotesEmpty("plain text")).toBe(false);
	});
});
