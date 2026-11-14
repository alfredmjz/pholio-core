export type ActionErrorCode = "unauthorized" | "invalid_input" | "not_found" | "failed";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: ActionErrorCode; message: string } };

/** Thrown inside an action or domain module for a failure the user should read as-is. */
export class ActionError extends Error {
	constructor(
		public readonly code: ActionErrorCode,
		message: string
	) {
		super(message);
		this.name = "ActionError";
	}
}

export const GENERIC_ACTION_ERROR = "Something went wrong. Please try again.";

export const DEMO_READONLY_ERROR = "Sample data: this change isn't saved.";
