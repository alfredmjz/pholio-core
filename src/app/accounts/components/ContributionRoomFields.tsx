"use client";

import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import {
	CONTRIBUTION_PLAN_OPTIONS,
	CRA_LOGIN_URL,
	getContributionPlanLabel,
	getRoomFieldLabel,
	getRoomHint,
	isRegisteredPlan,
} from "@/lib/contribution-plans";
import {
	getRoomYear,
	startOfCurrentYear,
	withPlanRoom,
	withRoomChange,
	type ContributionRoomFormValues,
} from "../contribution-room-form";
import type { ContributionPlan, RegisteredPlan } from "../types";
import type { ContributionRoomSetting } from "@/lib/types/contribution";

interface ContributionRoomFieldsProps {
	values: ContributionRoomFormValues;
	onChange: (changes: Partial<ContributionRoomFormValues>) => void;
	/** Saved plan rooms, used to prefill the fields when a registered plan is picked. */
	planRooms: ContributionRoomSetting[];
	error?: string;
}

/**
 * Registered-plan settings for investment accounts: which CRA rules apply and the room copied
 * from CRA My Account. The room is dated 1 January of the year it is entered, and registered
 * plans use CRA's published annual limits, so neither is typed in. For TFSA, RRSP, FHSA and
 * RESP the room is shared by every account of that plan.
 */
export function ContributionRoomFields({ values, onChange, planRooms, error }: ContributionRoomFieldsProps) {
	const selectedPlan = CONTRIBUTION_PLAN_OPTIONS.find((option) => option.value === values.contribution_plan);
	const isShared = isRegisteredPlan(values.contribution_plan);
	const planLabel = getContributionPlanLabel(values.contribution_plan || null);
	const currentYear = new Date().getFullYear();
	const roomYear = getRoomYear(values);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
				<div className="space-y-0.5">
					<Label htmlFor="track_contribution_room">Track Contribution Room</Label>
					<p className="type-body-sm text-muted-foreground">
						Track deposits against your TFSA, RRSP, FHSA or RESP limits.
					</p>
				</div>
				<Switch
					id="track_contribution_room"
					checked={values.track_contribution_room}
					onCheckedChange={(checked) =>
						onChange({
							track_contribution_room: checked,
							contribution_room_as_of: checked
								? values.contribution_room_as_of || startOfCurrentYear()
								: values.contribution_room_as_of,
						})
					}
				/>
			</div>

			{values.track_contribution_room && (
				<>
					<div className="space-y-2">
						<Label htmlFor="contribution_plan">Plan Type</Label>
						<Select
							value={values.contribution_plan || undefined}
							onValueChange={(value) =>
								onChange(withPlanRoom({ ...values, contribution_plan: value as ContributionPlan }, planRooms))
							}
						>
							<SelectTrigger id="contribution_plan" className="h-10">
								<SelectValue placeholder="Select a plan" />
							</SelectTrigger>
							<SelectContent>
								{CONTRIBUTION_PLAN_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedPlan && <p className="type-caption text-muted-foreground">{selectedPlan.description}</p>}
					</div>

					{values.contribution_plan && (
						<>
							{isShared && (
								<p className="rounded-md bg-info-muted px-3 py-2 type-caption text-info">
									Your {planLabel} room is shared by every {planLabel} account you track. Changing it here updates all
									of them.
								</p>
							)}

							<div className="space-y-2">
								<Label htmlFor="contribution_room">
									{getRoomFieldLabel(isShared ? (values.contribution_plan as RegisteredPlan) : "other")}
								</Label>
								<ProminentAmountInput
									id="contribution_room"
									value={values.contribution_room}
									onChange={(val) => onChange(withRoomChange(val))}
									hasError={!!error}
								/>
								{error ? (
									<p className="type-caption text-error">{error}</p>
								) : (
									<p className="type-caption text-muted-foreground">
										{getRoomHint(isShared ? (values.contribution_plan as RegisteredPlan) : "other", currentYear)}
									</p>
								)}
								{roomYear !== null && roomYear < currentYear && values.contribution_room && (
									<p className="type-caption text-muted-foreground">
										{values.contribution_plan === "tfsa"
											? `Entered for ${roomYear}. Each new year's CRA limit and last year's withdrawals are added automatically; update it when CRA shows a new figure.`
											: `Entered for ${roomYear}. Copy your ${currentYear} figure from CRA to keep this accurate.`}
									</p>
								)}
							</div>

							{!isShared && (
								<div className="space-y-2">
									<Label htmlFor="annual_limit">Annual Limit (optional)</Label>
									<ProminentAmountInput
										id="annual_limit"
										value={values.annual_contribution_limit}
										onChange={(val) => onChange({ annual_contribution_limit: val })}
										hasError={false}
									/>
									<p className="type-caption text-muted-foreground">
										Your own yearly limit for this account. Registered plans use CRA&apos;s limits automatically.
									</p>
								</div>
							)}

							<p className="type-caption text-muted-foreground">
								CRA does not share contribution room with apps. Copy your figures from{" "}
								<Link
									href={CRA_LOGIN_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="underline underline-offset-2 hover:text-primary"
								>
									CRA
								</Link>{" "}
								or your Notice of Assessment.
							</p>
						</>
					)}
				</>
			)}
		</div>
	);
}
