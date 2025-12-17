"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { LucideProps } from "lucide-react";

interface ServiceLogoProps extends LucideProps {
	name: string;
	serviceProvider?: string | null;
	/**
	 * If provided, allows overriding the domain guessing logic.
	 * e.g. "adobe.com" for "Adobe Creative Cloud"
	 */
	domain?: string;
	/**
	 * If true, forces the component to show the fallback initials and skips logo lookup.
	 */
	disableLookup?: boolean;
}

/**
 * Fallback initials component - shows first two letters of the name
 */
function InitialsFallback({
	name,
	className,
	width = 24,
	height = 24,
}: {
	name: string;
	className?: string;
	width?: number;
	height?: number;
}) {
	return (
		<div
			className={cn(
				"rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0",
				className
			)}
			style={{ width, height }}
		>
			<span className="font-bold text-primary text-[10px] sm:text-xs">
				{name.substring(0, 2).toUpperCase()}
			</span>
		</div>
	);
}

/**
 * ServiceLogo Component
 *
 * Displays a company/service logo fetched from our cached logo API.
 * Falls back to showing initials if the logo cannot be loaded.
 *
 * The logo is fetched via `/api/logos/[domain]` which:
 * - Caches logos in Redis for 7 days
 * - Proxies requests to logo.dev API
 * - Hides API token from client
 */
export function ServiceLogo({
	name,
	serviceProvider,
	domain,
	className,
	disableLookup,
	...props
}: ServiceLogoProps) {
	// Normalize keys for matching
	const normalizedName = name.toLowerCase().trim();
	const provider = serviceProvider?.toLowerCase().trim();

	// Skip lookup if disabled
	if (disableLookup) {
		return (
			<InitialsFallback
				name={name}
				className={className}
				width={(props.width as number) || 24}
				height={(props.height as number) || 24}
			/>
		);
	}

	// Build the domain for logo lookup
	const guessDomain =
		domain || (provider ? `${provider}.com` : `${normalizedName.replace(/\s+/g, "")}.com`);

	// Use our cached logo API route
	const logoUrl = `/api/logos/${encodeURIComponent(guessDomain)}`;

	// Track loading state
	const [imageLoaded, setImageLoaded] = useState(false);
	const [imageError, setImageError] = useState(false);
	const imgRef = useRef<HTMLImageElement>(null);
	const mountedRef = useRef(true);

	// Reset state when the logo URL changes
	useEffect(() => {
		setImageLoaded(false);
		setImageError(false);
	}, [logoUrl]);

	// Check if image is already cached/loaded when component mounts or URL changes
	useEffect(() => {
		// Use a small timeout to let the img element render and potentially load from cache
		const timeoutId = setTimeout(() => {
			const img = imgRef.current;
			if (mountedRef.current && img && img.complete && img.naturalWidth > 0) {
				setImageLoaded(true);
			}
		}, 50);

		return () => clearTimeout(timeoutId);
	}, [logoUrl]);

	// Cleanup on unmount
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const handleImageLoad = useCallback(() => {
		if (mountedRef.current) {
			setImageLoaded(true);
		}
	}, []);

	const handleImageError = useCallback(() => {
		if (mountedRef.current) {
			setImageError(true);
		}
	}, []);

	// Props for rendering
	const size = { width: (props.width as number) || 24, height: (props.height as number) || 24 };

	// If error occurred, show fallback
	if (imageError) {
		return (
			<InitialsFallback
				name={name}
				className={className}
				width={size.width}
				height={size.height}
			/>
		);
	}

	// Render with hidden probe image and conditional display
	return (
		<div className="relative" style={size}>
			{/* Hidden image to probe loading status */}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				ref={imgRef}
				src={logoUrl}
				alt=""
				aria-hidden="true"
				className="absolute opacity-0 pointer-events-none"
				style={{ width: 1, height: 1, top: 0, left: 0 }}
				onLoad={handleImageLoad}
				onError={handleImageError}
			/>

			{/* Show actual image when loaded, otherwise show fallback */}
			{imageLoaded ? (
				<div
					className={cn(
						"relative overflow-hidden rounded-full flex items-center justify-center bg-white",
						className
					)}
					style={size}
				>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={logoUrl} alt={name} className="object-cover w-full h-full" />
				</div>
			) : (
				<InitialsFallback
					name={name}
					className={className}
					width={size.width}
					height={size.height}
				/>
			)}
		</div>
	);
}
