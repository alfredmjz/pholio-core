import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string;
}

const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
	({ className, type, label, ...props }, ref) => {
		const [showPassword, setShowPassword] = React.useState(false);

		const isPassword = type === "password";
		const inputType = isPassword ? (showPassword ? "text" : "password") : type;

		return (
			<div className="relative">
				<input
					type={inputType}
					className={cn(
						"peer flex h-14 w-full rounded-md border border-input bg-background/80 px-3 pb-2 pt-6 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
						isPassword && "pr-12",
						className
					)}
					placeholder={label} // Placeholder required for peer-placeholder-shown to work
					ref={ref}
					{...props}
				/>
				<label
					className={cn(
						"absolute left-3 top-4 z-10 origin-[0] -translate-y-[12px] scale-75 transform text-muted-foreground duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-[12px] peer-focus:scale-75 pointer-events-none",
						isPassword && "max-w-[calc(100%-3rem)] truncate"
					)}
				>
					{label}
				</label>
				{isPassword && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="absolute right-2 top-2 h-10 w-10 text-muted-foreground hover:bg-transparent"
						onClick={() => setShowPassword(!showPassword)}
					>
						{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
						<span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
					</Button>
				)}
			</div>
		);
	}
);
FloatingLabelInput.displayName = "FloatingLabelInput";

export { FloatingLabelInput };
