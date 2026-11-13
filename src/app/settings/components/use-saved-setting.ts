import { useState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

type SaveResult = ActionResult<unknown>;

/** A setting that saves as soon as it changes, and goes back to its last value if saving fails. */
export function useSavedSetting<T>(initial: T, save: (value: T) => Promise<SaveResult>) {
	const [value, setValue] = useState(initial);
	const [saving, setSaving] = useState(false);

	const change = async (next: T) => {
		if (next === value) return;
		const previous = value;
		setValue(next);
		setSaving(true);
		try {
			const result = await save(next);
			if (!result.ok) throw new Error(result.error.message);
			toast.success("Saved");
		} catch (error) {
			setValue(previous);
			toast.error("Couldn't save the setting", {
				description: error instanceof Error && error.message ? error.message : "Try again.",
			});
		} finally {
			setSaving(false);
		}
	};

	return [value, change, saving] as const;
}
