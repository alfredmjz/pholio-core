/**
 * Account notes are rich text (HTML from the scratch pad's editor). For a while they were saved
 * as plain text; this turns either into editor HTML so every note opens with its lines, bullets
 * and numbering intact. Plain text is always escaped, so it can never become markup.
 */

/** Looks like markup from the editor: a real tag such as <p>, <br> or </li>. */
const HTML_TAG = /<\/?(p|br|ul|ol|li|strong|em|b|i|u|s|span|div|h[1-6]|blockquote|code|pre|hr)\b[^>]*>/i;

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function notesToHtml(notes: string | null | undefined): string {
	if (!notes) return "";
	if (HTML_TAG.test(notes)) return notes;

	let html = "";
	let list: "ul" | "ol" | null = null;
	const closeList = () => {
		if (list) html += `</${list}>`;
		list = null;
	};

	for (const line of notes.split(/\r?\n/)) {
		const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
		const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
		const item = bullet ?? numbered;
		if (item) {
			const kind = bullet ? "ul" : "ol";
			if (list !== kind) {
				closeList();
				html += `<${kind}>`;
				list = kind;
			}
			html += `<li><p>${escapeHtml(item[1])}</p></li>`;
			continue;
		}
		closeList();
		html += `<p>${escapeHtml(line.trimEnd())}</p>`;
	}
	closeList();
	return html;
}

/** True when the notes hold no written text, e.g. an editor left with an empty paragraph. */
export function isNotesEmpty(notes: string | null | undefined): boolean {
	if (!notes) return true;
	const text = notes
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.trim();
	return text.length === 0;
}
