"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { EmojiPicker } from "@/components/emoji-picker";
import { Edit, Trash2, Building2, Wallet, CreditCard, Landmark, TrendingUp, Building, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountWithType } from "../../types";

interface EditValues {
	name: string;
	institution: string;
	icon: string | null;
	notes: string;
}

interface AccountHeaderProps {
	account: AccountWithType;
	isEditing: boolean;
	editValues: EditValues;
	accountClass: "asset" | "liability" | undefined;
	onEditValuesChange: (values: EditValues) => void;
	onSave: () => Promise<void>;
	onCancel: () => void;
	onStartEdit: () => void;
	onDelete: () => void;
}

/**
 * Gets the default icon component based on account category.
 */
function getDefaultIcon(category: string | undefined) {
	switch (category) {
		case "banking":
			return <Landmark className="h-6 w-6" />;
		case "investment":
		case "retirement":
			return <TrendingUp className="h-6 w-6" />;
		case "property":
			return <Building className="h-6 w-6" />;
		case "credit":
		case "debt":
			return <CreditCard className="h-6 w-6" />;
		default:
			return <Wallet className="h-6 w-6" />;
	}
}

/**
 * Account header section with avatar, name, institution, and actions.
 */
export function AccountHeader({
	account,
	isEditing,
	editValues,
	accountClass,
	onEditValuesChange,
	onSave,
	onCancel,
	onStartEdit,
	onDelete,
}: AccountHeaderProps) {
	const handleIconSelect = (emoji: string | null) => {
		onEditValuesChange({ ...editValues, icon: emoji });
	};

	return (
		<div className="flex items-start gap-4">
			{/* Editable Avatar with EmojiPicker */}
			<EmojiPicker value={editValues.icon} onSelect={handleIconSelect} disabled={!isEditing} align="start">
				<Avatar
					className={cn(
						"h-16 w-16 transition-all",
						isEditing ? "cursor-pointer hover:ring-2 hover:ring-primary/20" : "cursor-default",
						accountClass === "asset" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
					)}
				>
					<AvatarFallback
						className={cn(
							"text-2xl",
							accountClass === "asset"
								? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
								: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
						)}
					>
						{editValues.icon ? editValues.icon : getDefaultIcon(account.account_type?.category)}
					</AvatarFallback>
				</Avatar>
			</EmojiPicker>

			{/* Title + Subtitle + Health */}
			<div className="flex-1 flex flex-col gap-1">
				{isEditing ? (
					<div className="space-y-2">
						<Input
							value={editValues.name}
							onChange={(e) => onEditValuesChange({ ...editValues, name: e.target.value })}
							className="h-8 text-lg font-bold px-2 w-full max-w-sm"
							autoFocus
						/>
						<div className="flex items-center gap-1.5">
							<Building2 className="h-3.5 w-3.5 text-muted-foreground" />
							<Input
								value={editValues.institution}
								onChange={(e) => onEditValuesChange({ ...editValues, institution: e.target.value })}
								className="h-7 text-sm px-2 w-full max-w-xs"
								placeholder="Institution"
							/>
						</div>
					</div>
				) : (
					<>
						<div className="flex items-center gap-3 flex-wrap">
							<h2 className="text-2xl font-bold tracking-tight">{account.name}</h2>
						</div>
						{account.institution && (
							<div className="text-sm text-muted-foreground flex items-center gap-1.5">
								<Building2 className="h-3.5 w-3.5" />
								{account.institution}
							</div>
						)}
					</>
				)}
			</div>

			{/* Actions */}
			<div className="flex items-center gap-1">
				{isEditing ? (
					<>
						<Button
							variant="ghost"
							size="icon"
							className="text-green-600 hover:text-green-700 hover:bg-green-50"
							onClick={onSave}
						>
							<Check className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="text-muted-foreground hover:text-foreground"
							onClick={onCancel}
						>
							<X className="h-4 w-4" />
						</Button>
					</>
				) : (
					<Button variant="ghost" size="icon" onClick={onStartEdit}>
						<Edit className="h-4 w-4" />
					</Button>
				)}
				<Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
