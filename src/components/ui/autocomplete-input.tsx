"use client";

import { useState, useRef, useEffect, useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AutocompleteInputProps {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	suggestions: string[];
	placeholder?: string;
	className?: string;
	required?: boolean;
	disabled?: boolean;
}

export function AutocompleteInput({
	id,
	value,
	onChange,
	suggestions,
	placeholder,
	className,
	required,
	disabled,
}: AutocompleteInputProps) {
	const listId = useId();
	const inputId = id ?? listId + "-input";
	const [isOpen, setIsOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const containerRef = useRef<HTMLDivElement>(null);

	const uniqueSuggestions = Array.from(new Set(suggestions.filter(Boolean)));

	// Filter suggestions based on user input
	const filteredSuggestions = value.trim()
		? uniqueSuggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
		: uniqueSuggestions;

	// Close menu on click outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!isOpen || filteredSuggestions.length === 0) {
			if (e.key === "ArrowDown" && filteredSuggestions.length > 0) {
				setIsOpen(true);
				setHighlightedIndex(0);
			}
			return;
		}

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
				break;
			case "Enter":
				if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
					e.preventDefault();
					selectSuggestion(filteredSuggestions[highlightedIndex]);
				}
				break;
			case "Escape":
				setIsOpen(false);
				setHighlightedIndex(-1);
				break;
		}
	};

	const selectSuggestion = (suggestion: string) => {
		onChange(suggestion);
		setIsOpen(false);
		setHighlightedIndex(-1);
	};

	return (
		<div ref={containerRef} className="relative w-full">
			<Input
				id={inputId}
				value={value}
				placeholder={placeholder}
				onChange={(e) => {
					onChange(e.target.value);
					setIsOpen(true);
					setHighlightedIndex(-1);
				}}
				onFocus={() => {
					if (filteredSuggestions.length > 0) {
						setIsOpen(true);
					}
				}}
				onKeyDown={handleKeyDown}
				className={cn("h-10", className)}
				required={required}
				disabled={disabled}
				autoComplete="off"
			/>
			{isOpen && filteredSuggestions.length > 0 && (
				<div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
					{filteredSuggestions.map((suggestion, index) => (
						<div
							key={suggestion}
							onMouseDown={(e) => {
								e.preventDefault();
								selectSuggestion(suggestion);
							}}
							onMouseEnter={() => setHighlightedIndex(index)}
							className={cn(
								"w-full px-3 py-2 text-sm cursor-pointer select-none transition-colors text-left first:rounded-t-md last:rounded-b-md",
								index === highlightedIndex
									? "bg-accent text-accent-foreground font-medium"
									: "hover:bg-accent hover:text-accent-foreground"
							)}
						>
							{suggestion}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
