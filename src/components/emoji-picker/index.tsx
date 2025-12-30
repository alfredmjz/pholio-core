"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
	type CarouselApi,
} from "@/components/ui/carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface EmojiPickerProps {
	/** Currently selected emoji */
	value: string | null;
	/** Callback when an emoji is selected */
	onSelect: (emoji: string | null) => void;
	/** Trigger element */
	children: React.ReactNode;
	/** Whether the picker is disabled */
	disabled?: boolean;
	/** Alignment of the popover */
	align?: "start" | "center" | "end";
	/** Additional class name for the popover content */
	className?: string;
}

// Relatable finance-focused emoji categories
const EMOJI_CATEGORIES = [
	{
		id: "money",
		name: "Cash & Sales",
		emojis: ["💰", "💵", "💸", "🤑", "🪙", "💳", "💴", "💶", "💷", "🧧", "💲", "🧾", "🏧", "💹", "💲"],
	},
	{
		id: "assets",
		name: "Assets & Property",
		emojis: ["🏠", "🚗", "🏎️", "🏢", "🏘️", "🧱", "🚜", "🚤", "🛥️", "🛤️", "🚁", "🏗️", "🏰", "🏝️", "⛺"],
	},
	{
		id: "growth",
		name: "Invest & Growth",
		emojis: ["📈", "📊", "🚀", "💎", "💍", "🎨", "🐂", "🌱", "🌳", "⚡", "🔥", "☀️", "🌟", "⭐", "👑"],
	},
	{
		id: "expenses",
		name: "Expenses & Life",
		emojis: ["🍔", "🛒", "🛍️", "🍕", "🚗", "⛽", "🏥", "🍼", "🐕", "🐱", "💊", "🎟️", "🏈", "🎮", "📱"],
	},
	{
		id: "travel",
		name: "Travel & Tech",
		emojis: ["✈️", "💻", "🏝️", "🏨", "🚢", "🌍", "🗽", "🗼", "📷", "🔋", "⌚", "🖥️", "🖨️", "🔧", "📺"],
	},
	{
		id: "liabilities",
		name: "Debt & Bills",
		emojis: ["📉", "🏚️", "🩸", "🧊", "🕸️", "🥀", "💸", "🚽", "⏳", "⚠️", "🆘", "📛", "🚫", "💢", "🗑️"],
	},
];

export function EmojiPicker({
	value,
	onSelect,
	children,
	disabled = false,
	align = "start",
	className,
}: EmojiPickerProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [api, setApi] = useState<CarouselApi>();
	const [currentSlide, setCurrentSlide] = useState(0);

	const handleSelect = (emoji: string) => {
		onSelect(emoji);
		setIsOpen(false);
	};

	const handleReset = () => {
		onSelect(null);
		setIsOpen(false);
	};

	useEffect(() => {
		if (!api) {
			return;
		}

		setCurrentSlide(api.selectedScrollSnap());

		api.on("select", () => {
			setCurrentSlide(api.selectedScrollSnap());
		});
	}, [api]);

	return (
		<Popover open={disabled ? false : isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent className={cn("w-72 p-0 overflow-hidden border-border", className)} align={align}>
				{/* Browser Header */}
				<div className="bg-muted/50 border-b p-2 flex items-center gap-2 select-none">
					{/* Windows Controls */}
					<div className="flex gap-1.5">
						<div className="w-2.5 h-2.5 rounded-full bg-red-500/80 shadow-sm" />
						<div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shadow-sm" />
						<div className="w-2.5 h-2.5 rounded-full bg-green-500/80 shadow-sm" />
					</div>

					{/* Address Bar */}
					<div className="flex-1 bg-background/50 rounded-md h-6 flex items-center justify-center border text-[10px] text-primary shadow-sm mx-1 px-2 relative group transition-colors hover:bg-background">
						<div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-30">🔒</div>
						<span className="font-medium truncate max-w-[120px]">
							{EMOJI_CATEGORIES[currentSlide]?.name || "Select Icon"}
						</span>
						<div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5">
							{EMOJI_CATEGORIES.map((_, index) => (
								<div
									key={index}
									className={cn(
										"h-1 w-1 rounded-full transition-colors",
										currentSlide === index ? "bg-primary" : "bg-primary/20"
									)}
								/>
							))}
						</div>
					</div>
				</div>

				<div className="p-1">
					<Carousel setApi={setApi} className="w-full">
						<CarouselContent>
							{EMOJI_CATEGORIES.map((category) => (
								<CarouselItem key={category.id}>
									<div className="p-2">
										<div className="grid grid-cols-5 gap-1">
											{category.emojis.map((emoji, idx) => (
												<Button
													key={`${emoji}-${idx}`}
													variant="ghost"
													size="sm"
													className={cn(
														"h-10 w-10 p-0 text-xl hover:bg-accent hover:scale-110 transition-transform",
														value === emoji && "bg-accent ring-2 ring-primary/20 scale-100"
													)}
													onClick={() => handleSelect(emoji)}
												>
													{emoji}
												</Button>
											))}
										</div>
									</div>
								</CarouselItem>
							))}
						</CarouselContent>

						{/* Navigation controls overlaid lightly or positioned */}
						<div className="flex items-center justify-between px-2 pb-2">
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => api?.scrollPrev()}
								disabled={currentSlide === 0}
							>
								<ChevronLeft />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-2 text-xs text-primary hover:text-primary"
								onClick={handleReset}
							>
								Reset Default
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => api?.scrollNext()}
								disabled={currentSlide === EMOJI_CATEGORIES.length - 1}
							>
								<ChevronRight />
							</Button>
						</div>
					</Carousel>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export type { EmojiPickerProps };
