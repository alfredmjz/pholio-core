"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface UseAuthFormProps {
	action: (formData: FormData) => Promise<{ error?: string; success?: string } | void>;
	validate?: (formData: FormData) => string | null;
	onSuccess?: (result?: { error?: string; success?: string } | void) => void;
	successMessage?: string;
}

export function useAuthForm({ action, validate, onSuccess, successMessage }: UseAuthFormProps) {
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!isMounted) return;

		setIsLoading(true);
		setError(null);
		setSuccess(null);

		const formData = new FormData(e.currentTarget);

		if (validate) {
			const validationError = validate(formData);
			if (validationError) {
				setIsLoading(false);
				return;
			}
		}

		try {
			const result = await action(formData);

			if (result?.error) {
				setError(result.error);
				toast.error("Error", {
					description: result.error,
				});
				setIsLoading(false);
			} else {
				if (result?.success) {
					setSuccess(result.success);
				}

				if (successMessage || result?.success) {
					toast.success("Success", {
						description: successMessage || result?.success,
					});
				}

				// Always reset loading state on success before calling onSuccess
				// This ensures the UI updates even if navigation is slow or fails
				setIsLoading(false);

				if (onSuccess) {
					onSuccess(result);
				}
			}
		} catch (err) {
			toast.error("Something went wrong", {
				description: "Please try again later.",
			});
			setIsLoading(false);
		}
	};

	return {
		handleSubmit,
		error,
		success,
		isLoading,
		isMounted,
		setIsLoading,
		setError,
	};
}
