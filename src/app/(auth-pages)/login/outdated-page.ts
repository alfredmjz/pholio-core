const PENDING_EMAIL_KEY = "pholio:login-email";

// A server action resolves to undefined when the open page is from an older deployment; a reload loads the current one.
export function reloadOutdatedPage(email: string) {
	try {
		sessionStorage.setItem(PENDING_EMAIL_KEY, email);
	} catch {
		// Storage can be blocked; the reload still fixes the page, the email just isn't refilled.
	}
	window.location.reload();
}

export function takePendingEmail(): string | null {
	try {
		const email = sessionStorage.getItem(PENDING_EMAIL_KEY);
		sessionStorage.removeItem(PENDING_EMAIL_KEY);
		return email;
	} catch {
		return null;
	}
}
