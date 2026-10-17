import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input"> & { startAdornment?: React.ReactNode }>(
	({ className, type, startAdornment, ...props }, ref) => {
		if (startAdornment) {
			return (
				<div
					className={cn(
						"flex h-9 w-full items-center rounded-md border border-field-border bg-field px-3 py-1 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-field-focus disabled:cursor-not-allowed disabled:opacity-50",
						className
					)}
				>
					<div className="mr-2 text-muted-foreground flex items-center">{startAdornment}</div>
					<input
						type={type}
						className="flex-1 bg-transparent border-none outline-none placeholder:text-field-placeholder text-primary text-base md:text-sm h-full w-full"
						ref={ref}
						suppressHydrationWarning
						{...props}
					/>
				</div>
			);
		}
		return (
			<input
				type={type}
				className={cn(
					"flex h-9 w-full rounded-md border border-field-border bg-field px-3 py-1 text-base text-primary shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary placeholder:text-field-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-focus disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
					className
				)}
				ref={ref}
				suppressHydrationWarning
				{...props}
			/>
		);
	}
);
Input.displayName = "Input";

export { Input };
