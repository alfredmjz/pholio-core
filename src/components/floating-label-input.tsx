import * as React from "react";
import { cn } from "@/lib/utils";

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string;
	hasError?: boolean;
}

const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
	({ className, label, hasError, ...props }, ref) => {
		return (
			<div className="relative">
				<input
					className={cn(
						"peer flex h-14 w-full rounded-md border border-field-border bg-field px-3 pb-2 pt-6 text-sm text-primary file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-focus disabled:cursor-not-allowed disabled:opacity-50",
						hasError && "border-error focus-visible:ring-error",
						className
					)}
					placeholder={label} // Placeholder required for peer-placeholder-shown to work
					ref={ref}
					{...props}
				/>
				<label
					className={cn(
						"absolute left-3 top-4 z-10 origin-[0] -translate-y-[12px] scale-75 transform text-muted-foreground duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-[12px] peer-focus:scale-75 pointer-events-none",
						hasError && "text-error"
					)}
				>
					{label}
					{props.required && <span className="text-error ml-0.5">*</span>}
				</label>
			</div>
		);
	}
);
FloatingLabelInput.displayName = "FloatingLabelInput";

export { FloatingLabelInput };
