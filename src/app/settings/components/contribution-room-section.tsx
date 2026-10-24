"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveContributionRoom } from "@/lib/actions/contribution-actions";
import {
	CRA_MY_ACCOUNT_URL,
	REGISTERED_PLANS,
	getContributionPlanLabel,
	getRoomFieldLabel,
	getRoomHint,
} from "@/lib/contribution-plans";
import { getCurrencySymbol } from "@/lib/format";
import { sanitizeDecimalInput } from "@/lib/input-utils";
import { startOfCurrentYear } from "@/app/accounts/contribution-room-form";
import type { RegisteredPlan } from "@/app/accounts/types";
import type { ContributionRoomSetting } from "@/lib/types/contribution";
import { SettingRow, SettingsSection } from "./settings-section";

export function ContributionRoomSection({ rooms }: { rooms: ContributionRoomSetting[] }) {
	return (
		<SettingsSection
			id="contribution-room"
			title="Contribution room"
			note="Each plan's room is shared by every account of that plan."
		>
			{REGISTERED_PLANS.map((plan) => (
				<PlanRoomRow key={plan} plan={plan} saved={rooms.find((room) => room.plan === plan) ?? null} />
			))}
			<p className="type-body-sm pt-4 text-muted-foreground">
				CRA doesn&apos;t share contribution room with apps. Copy your figures from{" "}
				<Link
					href={CRA_MY_ACCOUNT_URL}
					target="_blank"
					rel="noopener noreferrer"
					className="underline underline-offset-2 hover:text-primary"
				>
					CRA My Account
				</Link>{" "}
				or your Notice of Assessment.
			</p>
		</SettingsSection>
	);
}

function PlanRoomRow({ plan, saved: initial }: { plan: RegisteredPlan; saved: ContributionRoomSetting | null }) {
	const [saved, setSaved] = useState(initial);
	const savedValue = saved?.room === null || saved?.room === undefined ? "" : String(saved.room);
	const [value, setValue] = useState(savedValue);
	const [isPending, startTransition] = useTransition();
	const dirty = value !== savedValue;
	const currentYear = new Date().getFullYear();
	const savedYear = saved?.room_as_of ? Number(saved.room_as_of.slice(0, 4)) : null;
	const inputId = `room-${plan}`;

	const save = (event: React.FormEvent) => {
		event.preventDefault();
		const setting: ContributionRoomSetting = {
			plan,
			room: value ? parseFloat(value) : null,
			room_as_of: startOfCurrentYear(),
			annual_limit: saved?.annual_limit ?? null,
		};
		startTransition(async () => {
			if (await saveContributionRoom(setting)) {
				setSaved(setting);
				toast.success("Saved", { description: `${getContributionPlanLabel(plan)} room updated for every account.` });
			} else {
				toast.error("Couldn't save the room", { description: "Try again." });
			}
		});
	};

	return (
		<SettingRow
			label={getRoomFieldLabel(plan)}
			htmlFor={inputId}
			description={
				<>
					{getRoomHint(plan, currentYear)}
					{savedYear !== null && savedYear < currentYear && savedValue && (
						<>
							{" "}
							{plan === "tfsa"
								? `Entered for ${savedYear}; each new year's limit is added for you.`
								: `Entered for ${savedYear}. Copy your ${currentYear} figure to keep it accurate.`}
						</>
					)}
				</>
			}
		>
			<form onSubmit={save} className="flex w-full items-center gap-2 row-wide:w-56">
				<Input
					id={inputId}
					inputMode="decimal"
					placeholder="Not set"
					startAdornment={getCurrencySymbol()}
					value={value}
					onChange={(event) => setValue(sanitizeDecimalInput(event.target.value, 2))}
					onKeyDown={(event) => event.key === "Escape" && setValue(savedValue)}
					disabled={isPending}
				/>
				{dirty && (
					<Button type="submit" size="sm" className="h-10 shrink-0" disabled={isPending}>
						{isPending ? "Saving..." : "Save"}
					</Button>
				)}
			</form>
		</SettingRow>
	);
}
