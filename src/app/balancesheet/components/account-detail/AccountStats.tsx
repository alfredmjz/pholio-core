"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AccountWithType } from "../../types";

interface AccountStatsProps {
	account: AccountWithType;
	accountClass: "asset" | "liability" | undefined;
	progress: number | null;
	formatCurrency: (amount: number) => string;
}

/**
 * Account statistics section with balance, interest rate, and goal progress.
 */
export function AccountStats({ account, accountClass, progress, formatCurrency }: AccountStatsProps) {
	return (
		<div className="flex items-start gap-8 flex-wrap">
			{/* Current Balance */}
			<div className="flex flex-col gap-1">
				<span className="text-xs font-medium text-primary uppercase tracking-wider">Current Balance</span>
				<div
					className={cn(
						"text-3xl font-bold tracking-tight",
						accountClass === "asset" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
					)}
				>
					{formatCurrency(account.current_balance)}
				</div>
				{account.interest_rate && (
					<div className="flex items-center gap-2 text-sm text-primary">
						<Badge variant="secondary" className="text-xs">
							APY
						</Badge>
						<span>{(account.interest_rate * 100).toFixed(2)}%</span>
					</div>
				)}
			</div>

			{/* Target / Goal with Enhanced Progress */}
			{account.target_balance && (
				<div className="flex flex-col gap-2 flex-1 min-w-[200px]">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-primary uppercase tracking-wider">
							{accountClass === "asset" ? "Target Goal" : "Original Loan"}
						</span>
						<span className="text-sm font-medium text-primary">{formatCurrency(account.target_balance)}</span>
					</div>
					{progress !== null && (
						<div className="flex flex-col gap-2 relative mt-4">
							{/* Progress Bar Container */}
							<div className="relative">
								<Progress
									value={Math.min(progress, 100)}
									className={cn("h-3", accountClass === "asset" ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500")}
								/>

								{/* Dynamic Health Indicator on the tip */}
								<div
									className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-in-out z-10"
									style={{
										left: `${Math.min(progress, 100)}%`,
									}}
								>
									<div className="relative group flex items-center justify-center">
										{/* Realistic Burning Flame Effect */}
										{progress > 0 && (
											<div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center overflow-visible">
												{/* Core Flame */}
												<div
													className={cn(
														"absolute  rounded-full blur-md transition-all duration-500 bg-success/70",
														progress < 25
															? "h-10 w-8"
															: progress < 50
																? "h-12 w-10"
																: progress < 75
																	? "h-14 w-12"
																	: "h-16 w-14 brightness-125"
													)}
												/>

												{/* Inner Heat (White/Yellow core for high progress) */}
												{progress >= 75 && (
													<div className="absolute left-1/2 bottom-1 -translate-x-1/2 w-4 h-8 bg-white/40 rounded-full blur-sm animate-pulse" />
												)}
											</div>
										)}

										{/* Icon Badge - Circle that expands */}
										<div
											className={cn(
												"relative z-10 flex items-center justify-center rounded-full shadow-md cursor-help transition-all duration-300 ease-out bg-primary text-background overflow-hidden", // Sizing & Expansion
												"w-8 h-8 p-0 group-hover:w-auto group-hover:px-3 group-hover:gap-2",
												progress >= 75 && "scale-110"
											)}
										>
											<span className="text-base flex-shrink-0 leading-none">
												{progress == 0
													? "🌱"
													: progress < 25
														? "🚶"
														: progress < 50
															? "🚲"
															: progress < 75
																? "✈️"
																: "🚀"}
											</span>
											<span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 transition-all duration-300 whitespace-nowrap text-[10px] font-bold overflow-hidden">
												{Math.min(progress, 100).toFixed(0)}%
											</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
