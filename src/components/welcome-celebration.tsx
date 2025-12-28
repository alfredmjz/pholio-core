"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";

interface WelcomeCelebrationProps {
	forceOpen?: boolean;
	redirectUrl?: string;
}

export function WelcomeCelebration({ forceOpen = false, redirectUrl }: WelcomeCelebrationProps) {
	const router = useRouter();
	const searchParams = useSearchParams();

	// Derive initial state immediately
	const shouldBeOpen = forceOpen || searchParams.get("welcome") === "true";
	const [open, setOpen] = useState(shouldBeOpen);

	// Sync state with props/params if they change
	useEffect(() => {
		setOpen(shouldBeOpen);
	}, [shouldBeOpen]);

	useEffect(() => {
		if (open) {
			// Single burst "pop" of confetti from both sides
			confetti({
				particleCount: 80,
				angle: 60,
				spread: 55,
				origin: { x: 0, y: 0.6 },
				colors: ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7"],
				ticks: 300, // Duration - higher = lasts longer (default: 200)
				gravity: 0.8, // Fall speed - lower = floats more (default: 1)
			});
			confetti({
				particleCount: 80,
				angle: 120,
				spread: 55,
				origin: { x: 1, y: 0.6 },
				colors: ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7"],
				ticks: 300,
				gravity: 0.8,
			});
		}
	}, [open]);

	const handleClose = () => {
		setOpen(false);
		if (redirectUrl) {
			router.push(redirectUrl);
			return;
		}
		// Clean up the URL
		const newParams = new URLSearchParams(searchParams.toString());
		newParams.delete("welcome");
		router.replace(`?${newParams.toString()}`);
	};

	// Don't render if not open
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
			{/* Wrapper for Card and Balloons - Relative container to hold them together */}
			<div className="relative w-full max-w-md mx-4 animate-in zoom-in-95 duration-300">
				{/* Balloons - Layer 0 (Behind Card) */}
				{/* Positioned comfortably inside the container area so they start strictly behind opacity */}
				<div className="absolute inset-0 z-0 pointer-events-none select-none">
					{[...Array(30)].map((_, i) => (
						<div
							key={i}
							className="absolute bottom-[20px] text-7xl animate-float-up opacity-0"
							style={
								{
									left: `${-25 + i * 4}%`,
									animationDuration: `${3 + Math.random() * 2}s`,
									// Increase horizontal drift for wider spread
									"--float-x": (Math.random() - 0.5) * 600,
									"--float-r": (Math.random() - 0.5) * 100,
									// Randomly reflect (flip) the balloon horizontally for variety
									"--scale-x": Math.random() > 0.5 ? 1 : -1,
								} as React.CSSProperties
							}
						>
							🎈
						</div>
					))}
				</div>

				{/* Card Content - Z-index 10 to sit ON TOP of balloons */}
				{/* Needs a solid background color to hide the starting balloons */}
				<div className="bg-card border border-border shadow-2xl rounded-xl p-8 relative z-10 overflow-hidden">
					<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#FFD700] via-[#448361] to-[#2EAADC]" />

					<div className="flex flex-col items-center text-center space-y-6">
						<div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center dark:bg-green-900/20">
							<span className="text-4xl">🎊</span>
						</div>

						<div className="space-y-2">
							<h2 className="text-2xl font-bold tracking-tight">Welcome to Pholio!</h2>
							<div className="text-primary space-y-1">
								<p>Your account has been verified successfully.</p>
								<p>You're all set to look professional.</p>
							</div>
						</div>

						<Button onClick={handleClose} className="w-full h-12 text-base font-medium relative overflow-hidden group">
							<span className="absolute inset-0 bg-success -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out" />
							<span className="relative flex items-center justify-center">
								Let's get started <ArrowRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
							</span>
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
