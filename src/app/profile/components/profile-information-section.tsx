'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateProfile } from '../actions';
import type { UserProfile } from '@/lib/getUserProfile';
import { cn } from '@/lib/utils';

interface ProfileInformationSectionProps {
	profile: UserProfile | null;
	userEmail: string;
}

/**
 * Profile Information Section
 * 
 * Clean, card-less design matching modern SaaS patterns (Claude.ai, Linear, Vercel)
 * Uses section-based layout with subtle dividers instead of Card components
 * 
 * Features:
 * - Section header with bottom border divider
 * - Avatar display with gradient background
 * - Inline edit pattern for name field
 * - Read-only email display
 * - Member since footer
 * - Disabled state for guest accounts
 */
export default function ProfileInformationSection({ 
	profile, 
	userEmail 
}: ProfileInformationSectionProps) {
	const [isEditingName, setIsEditingName] = useState(false);
	const [nameValue, setNameValue] = useState(profile?.full_name || '');
	const [isPending, startTransition] = useTransition();

	// Sync state when profile changes (e.g., after revalidation)
	useEffect(() => {
		setNameValue(profile?.full_name || '');
	}, [profile?.full_name]);

	const handleNameSave = () => {
		if (!nameValue.trim()) {
			toast.error('Name cannot be empty');
			return;
		}

		const formData = new FormData();
		formData.append('fullName', nameValue);

		startTransition(async () => {
			const result = await updateProfile(formData);

			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success(result.message);
				setIsEditingName(false);
			}
		});
	};

	const handleNameCancel = () => {
		setNameValue(profile?.full_name || '');
		setIsEditingName(false);
	};

	// Generate initials for avatar
	const getInitials = () => {
		if (profile?.full_name) {
			return profile.full_name
				.split(' ')
				.map((n: string) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2);
		}
		if (profile?.guest_name) {
			return profile.guest_name
				.split(' ')
				.map((n: string) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2);
		}
		return userEmail?.[0]?.toUpperCase() || '?';
	};

	const displayName = profile?.full_name || profile?.guest_name || 'User';

	// Format date
	const formatDate = (date: string) => {
		if (!date) return 'Unknown';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	return (
		<section className="space-y-6">
			{/* Section Header */}
			<div className="pb-3 border-b border-white/10">
				<h2 className="text-lg font-semibold text-text-primary">Profile Information</h2>
				<p className="text-sm text-text-secondary mt-1">
					{profile?.is_guest
						? 'Your guest account information'
						: 'Update your personal details'}
				</p>
			</div>

			{/* Avatar Section */}
			<div className="flex items-center gap-4">
				<div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
					{getInitials()}
				</div>
				<div>
					<p className="text-sm font-medium text-text-primary">{displayName}</p>
					<p className="text-xs text-text-secondary mt-0.5">
						{profile?.is_guest ? 'Guest Account' : userEmail}
					</p>
				</div>
			</div>

			{/* Form Fields */}
			<div className="space-y-5 max-w-md">
				{/* Full Name Field */}
				<div className="space-y-2">
					<Label 
						htmlFor="fullName"
						className="text-sm font-medium text-text-primary"
					>
						{profile?.is_guest ? 'Display Name' : 'Full Name'}
					</Label>
					{!isEditingName ? (
						<div className={cn(
							"flex items-center justify-between px-3 py-2.5 rounded-md border border-white/10 bg-white/5 transition-colors group",
							profile?.is_guest
								? "opacity-60 cursor-not-allowed"
								: "hover:bg-white/8"
						)}>
							<span className="text-sm text-text-primary">{displayName}</span>
							{!profile?.is_guest && (
								<Button
									variant="ghost"
									size="sm"
									className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs"
									onClick={() => setIsEditingName(true)}
								>
									Edit
								</Button>
							)}
						</div>
					) : (
						<div className="space-y-3">
							<Input
								id="fullName"
								value={nameValue}
								onChange={(e) => setNameValue(e.target.value)}
								placeholder="Enter your full name"
								disabled={isPending || profile?.is_guest}
								className={cn(
									"bg-white/5 border-white/10 text-text-primary placeholder:text-text-secondary",
									profile?.is_guest && 'cursor-not-allowed opacity-60'
								)}
								maxLength={255}
							/>
							<div className="flex gap-2">
								<Button
									size="sm"
									onClick={handleNameSave}
									disabled={isPending || !nameValue.trim()}
									className="h-8 px-3 text-xs"
								>
									{isPending ? 'Saving...' : 'Save'}
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={handleNameCancel}
									disabled={isPending}
									className="h-8 px-3 text-xs"
								>
									Cancel
								</Button>
							</div>
						</div>
					)}
				</div>

				{/* Email Field (Read-only) */}
				<div className="space-y-2">
					<Label className="text-sm font-medium text-text-primary">Email</Label>
					<div className="px-3 py-2.5 rounded-md border border-white/10 bg-white/5">
						<p className="text-sm text-text-primary">
							{profile?.is_guest ? (
								<span className="text-text-secondary italic">
									No email (Guest Account)
								</span>
							) : (
								userEmail
							)}
						</p>
					</div>
					{!profile?.is_guest && (
						<p className="text-xs text-text-secondary">
							To change your email, use the Security section below
						</p>
					)}
				</div>

				{/* Member Since */}
				<div className="pt-4 border-t border-white/10">
					<p className="text-xs text-text-secondary">
						Member since {formatDate(profile?.created_at)}
					</p>
				</div>
			</div>
		</section>
	);
}
