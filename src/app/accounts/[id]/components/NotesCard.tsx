"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SurfaceSection } from "@/components/layout/surface-section";
import { Button } from "@/components/ui/button";
import { ScratchPad } from "@/components/common/scratch-pad";
import { isNotesEmpty, notesToHtml } from "@/lib/notes";
import { isSampleDataActive } from "@/lib/demo-mode";
import { updateAccount } from "../../actions";
import type { AccountWithType } from "../../types";

interface NotesCardProps {
	account: AccountWithType;
	onAccountUpdated: (account: AccountWithType) => void;
}

/**
 * The account's scratch pad, written straight on the card: click and write. Discard and Save
 * appear only once something has changed.
 */
export function NotesCard({ account, onAccountUpdated }: NotesCardProps) {
	const saved = notesToHtml(account.notes);
	const [draft, setDraft] = useState(saved);
	const [isSaving, setIsSaving] = useState(false);
	// The editor may tidy the saved HTML on load; treat that as unchanged.
	const [baseline, setBaseline] = useState<string | null>(null);
	const isDirty = baseline !== null && draft !== baseline;

	const handleChange = (html: string) => {
		if (baseline === null) setBaseline(saved);
		setDraft(html);
	};

	const discard = () => {
		setDraft(saved);
		setBaseline(null);
	};

	const handleSave = async () => {
		const next = isNotesEmpty(draft) ? null : draft;
		setIsSaving(true);
		try {
			// Sample data: the account page keeps the change in the demo store (via onAccountUpdated).
			const result = isSampleDataActive() || (await updateAccount(account.id, { notes: next }));
			if (result) {
				toast.success("Notes saved");
				setBaseline(null);
				onAccountUpdated({ ...account, notes: next });
			} else {
				toast.error("Couldn't save your notes", { description: "Try again in a moment." });
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
			toast.error("Couldn't save your notes", { description: errorMessage });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<SurfaceSection
			id="notes-heading"
			title="Notes"
			headerActions={
				isDirty ? (
					<>
						<Button variant="ghost" size="sm" className="h-8 rounded-full px-3" onClick={discard} disabled={isSaving}>
							Discard
						</Button>
						<Button size="sm" className="h-8 rounded-full px-3" onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</>
				) : undefined
			}
		>
			<ScratchPad
				value={draft}
				onChange={handleChange}
				aria-label={`Notes for ${account.name}`}
				placeholder="Click to write. Promo end dates, who to call, plans for this account…"
				minLines={4}
			/>
		</SurfaceSection>
	);
}
