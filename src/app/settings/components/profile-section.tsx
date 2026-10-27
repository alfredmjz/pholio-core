"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLongDate } from "@/lib/date-utils";
import type { UserProfile } from "@/lib/getUserProfile";
import { updateProfile } from "../actions";
import ProfileAvatarUpload from "./profile-avatar-upload";
import { SettingRow, SettingsSection } from "./settings-section";

interface ProfileSectionProps {
	profile: UserProfile;
	email: string;
}

function initialsFor(name: string, email: string): string {
	const initials = name
		.split(" ")
		.filter(Boolean)
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	return initials || email[0]?.toUpperCase() || "?";
}

export function ProfileSection({ profile, email }: ProfileSectionProps) {
	const savedName = profile.full_name ?? "";
	const [name, setName] = useState(savedName);
	const [isPending, startTransition] = useTransition();
	const dirty = name.trim() !== savedName;

	useEffect(() => setName(savedName), [savedName]);

	const save = (event: React.FormEvent) => {
		event.preventDefault();
		if (!name.trim()) {
			toast.error("Couldn't save your name", { description: "Your name can't be empty." });
			return;
		}
		const formData = new FormData();
		formData.append("fullName", name);
		startTransition(async () => {
			const result = await updateProfile(formData);
			if (result.error) {
				toast.error("Couldn't save your name", { description: result.error });
			} else {
				toast.success("Saved");
			}
		});
	};

	return (
		<SettingsSection id="profile" title="Profile">
			<div className="flex items-center gap-4 pb-4">
				<ProfileAvatarUpload currentAvatarUrl={profile.avatar_url} currentInitials={initialsFor(savedName, email)} />
				<div className="min-w-0">
					<p className="type-body-lg truncate font-medium text-primary">{savedName || "Add your name"}</p>
					<p className="type-body-sm text-muted-foreground">
						Member since {formatLongDate(profile.created_at)}. Select the picture to change it.
					</p>
				</div>
			</div>

			<SettingRow label="Name" htmlFor="fullName">
				<form onSubmit={save} className="flex w-full items-center gap-2 row-wide:w-80">
					<Input
						id="fullName"
						value={name}
						onChange={(event) => setName(event.target.value)}
						onKeyDown={(event) => event.key === "Escape" && setName(savedName)}
						placeholder="Your name"
						maxLength={255}
						autoComplete="name"
						disabled={isPending}
					/>
					{dirty && (
						<Button type="submit" size="sm" className="h-10 shrink-0" disabled={isPending || !name.trim()}>
							{isPending ? "Saving..." : "Save"}
						</Button>
					)}
				</form>
			</SettingRow>
		</SettingsSection>
	);
}
