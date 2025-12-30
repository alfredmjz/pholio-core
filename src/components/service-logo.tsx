"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { GoogleSheetsIcon } from "@/components/icons/allocation-icons";
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
	 * If true, forces the component to show the fallback initials and skips specific logo lookup.
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
			className={cn("rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0", className)}
			style={{ width, height }}
		>
			<span className="font-bold text-primary text-[10px] sm:text-xs">{name.substring(0, 2).toUpperCase()}</span>
		</div>
	);
}

type LogoType = "gsheets" | "external" | "fallback";

export function ServiceLogo({ name, serviceProvider, domain, className, ...props }: ServiceLogoProps) {
	// 1. Normalize keys for matching - this determines the logo type
	const normalizedName = name.toLowerCase().trim();
	const provider = serviceProvider?.toLowerCase().trim();
	// Determine which type of logo to render
	const getLogoType = (): LogoType => {
		if (props.disableLookup) return "fallback";
		if (normalizedName.includes("google sheet") || normalizedName.includes("gsheet")) return "gsheets";
		return "external";
	};

	const logoType = getLogoType();

	// Build logo URL for external logos
	const guessDomain = domain || (provider ? `${provider}.com` : `${normalizedName.replace(/\s+/g, "")}.com`);
	const logoDevToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
	const logoUrl =
		logoType === "external" && logoDevToken ? `https://img.logo.dev/${guessDomain}?token=${logoDevToken}` : null;

	// Track loading state for external logos
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
		if (!logoUrl) return;

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
	const size = { width: props.width || 24, height: props.height || 24 };

	// HERO ICONS: Render local SVG icons for known brands
	if (logoType === "gsheets") {
		return <GoogleSheetsIcon className={className} {...props} />;
	}

	// EXTERNAL LOGOS: Use logo.dev API
	// If no valid URL or error occurred, show fallback
	if (!logoUrl || imageError) {
		return (
			<InitialsFallback name={name} className={className} width={size.width as number} height={size.height as number} />
		);
	}

	// Render with hidden probe image and conditional display
	return (
		<div className="relative" style={size}>
			{/* Hidden image to probe loading status - always rendered for external logos */}
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
				<div className={cn("overflow-hidden rounded-full flex items-center justify-center", className)} style={size}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={logoUrl} alt={name} className="object-contain w-full h-full" />
				</div>
			) : (
				<InitialsFallback
					name={name}
					className={className}
					width={size.width as number}
					height={size.height as number}
				/>
			)}
		</div>
	);
}
