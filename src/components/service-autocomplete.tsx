"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ServiceLogo } from "@/components/service-logo";

interface BrandSuggestion {
	name: string;
	domain: string;
}

interface ServiceAutocompleteProps {
	value: string;
	onChange: (value: string, domain?: string) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
}

/**
 * Autocomplete input for service names with brand suggestions from logo.dev
 * Shows logo previews alongside suggestions
 */
export function ServiceAutocomplete({
	value,
	onChange,
	placeholder = "Enter service name...",
	className,
	disabled,
}: ServiceAutocompleteProps) {
	const [suggestions, setSuggestions] = useState<BrandSuggestion[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const debounceRef = useRef<NodeJS.Timeout | null>(null);

	// Fetch suggestions from API
	const fetchSuggestions = useCallback(async (query: string) => {
		if (query.length < 2) {
			setSuggestions([]);
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch(`/api/logos/search?q=${encodeURIComponent(query)}`);
			const data = await response.json();

			if (data.results) {
				setSuggestions(data.results);
				setIsOpen(data.results.length > 0);
			} else {
				setSuggestions([]);
			}
		} catch (error) {
			console.error("Error fetching suggestions:", error);
			setSuggestions([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Debounced search
	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			fetchSuggestions(value);
		}, 300);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [value, fetchSuggestions]);

	// Handle click outside to close dropdown
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Handle keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!isOpen || suggestions.length === 0) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
				break;
			case "ArrowUp":
				e.preventDefault();
				setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
				break;
			case "Enter":
				e.preventDefault();
				if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
					selectSuggestion(suggestions[highlightedIndex]);
				}
				break;
			case "Escape":
				setIsOpen(false);
				setHighlightedIndex(-1);
				break;
		}
	};

	const selectSuggestion = (suggestion: BrandSuggestion) => {
		onChange(suggestion.name, suggestion.domain);
		setIsOpen(false);
		setHighlightedIndex(-1);
		setSuggestions([]);
	};

	return (
		<div ref={containerRef} className="relative">
			<div className="relative">
				<Input
					ref={inputRef}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onFocus={() => suggestions.length > 0 && setIsOpen(true)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className={className}
					disabled={disabled}
				/>
				{isLoading && (
					<div className="absolute right-3 top-1/2 -translate-y-1/2">
						<Loader2 className="h-4 w-4 animate-spin text-primary" />
					</div>
				)}
			</div>

			{/* Dropdown */}
			{isOpen && suggestions.length > 0 && (
				<div className="absolute z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-2xl border border-border/80 bg-popover p-1.5 shadow-raised">
					{suggestions.map((suggestion, index) => (
						<div
							key={suggestion.domain}
							className={cn(
								"flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors",
								index === highlightedIndex && "bg-primary/[0.05]"
							)}
							onClick={() => selectSuggestion(suggestion)}
							onMouseEnter={() => setHighlightedIndex(index)}
						>
							<ServiceLogo
								name={suggestion.name}
								domain={suggestion.domain}
								width={24}
								height={24}
								className="flex-shrink-0"
							/>
							<div className="flex flex-col min-w-0">
								<span className="type-body-sm truncate font-medium text-primary">{suggestion.name}</span>
								<span className="type-body-xs truncate text-muted-foreground">{suggestion.domain}</span>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
