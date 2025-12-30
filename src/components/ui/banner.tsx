"use client";

import { type LucideIcon, X } from "lucide-react";
import {
	type ComponentProps,
	createContext,
	type HTMLAttributes,
	type MouseEventHandler,
	useContext,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BannerContextProps = {
	icon?: LucideIcon;
	open?: boolean;
	defaultOpen?: boolean;
	onClose?: MouseEventHandler<HTMLButtonElement>;
	onOpenChange?: (open: boolean) => void;
};

const BannerContext = createContext<BannerContextProps>({});

const Banner = ({
	open: openProp,
	defaultOpen = true,
	onOpenChange,
	onClose,
	icon,
	className,
	...props
}: HTMLAttributes<HTMLDivElement> & BannerContextProps) => {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);

	const open = openProp !== undefined ? openProp : internalOpen;

	const setOpen = (value: boolean) => {
		if (onOpenChange) {
			onOpenChange(value);
		}
		if (openProp === undefined) {
			setInternalOpen(value);
		}
	};

	if (!open) return null;

	return (
		<BannerContext.Provider value={{ icon, open, onClose, onOpenChange: setOpen }}>
			<div className={cn("relative flex w-full items-center gap-3 rounded-lg border p-4", className)} {...props} />
		</BannerContext.Provider>
	);
};

const BannerIcon = ({
	icon: iconProp,
	className,
	...props
}: HTMLAttributes<HTMLDivElement> & { icon?: LucideIcon }) => {
	const { icon: iconContext } = useContext(BannerContext);
	const Icon = iconProp ?? iconContext;

	if (!Icon) return null;

	return (
		<div className={cn("text-foreground", className)} {...props}>
			<Icon className="size-5" />
		</div>
	);
};

const BannerTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
	<h3 className={cn("flex-1 text-sm font-medium", className)} {...props} />
);

const BannerAction = ({ className, ...props }: ComponentProps<typeof Button>) => (
	<Button variant="ghost" size="sm" className={cn("h-auto p-0 text-sm underline", className)} {...props} />
);

const BannerClose = ({ className, ...props }: ComponentProps<typeof Button>) => {
	const { onClose, onOpenChange } = useContext(BannerContext);

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={(e) => {
				if (onClose) onClose(e);
				if (onOpenChange) onOpenChange(false);
			}}
			className={cn("size-7 p-0 text-muted-foreground", className)}
			{...props}
		>
			<X className="size-4" />
			<span className="sr-only">Close</span>
		</Button>
	);
};

export { Banner, BannerAction, BannerClose, BannerIcon, BannerTitle };

