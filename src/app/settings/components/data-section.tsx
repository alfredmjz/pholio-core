"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { Button } from "@/components/ui/button";
import { deleteMyAccount, exportMyData, resetMyData } from "../actions";
import { DELETE_ACCOUNT_CONFIRMATION, RESET_DATA_CONFIRMATION } from "../data-export";
import { SettingRow, SettingsSection } from "./settings-section";

function download(filename: string, csv: string) {
	// The byte-order mark makes Excel read the file as UTF-8 (accents, € and £).
	const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff), csv], { type: "text/csv;charset=utf-8" }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export function DataSection({ isSampleData }: { isSampleData: boolean }) {
	const router = useRouter();
	const [exporting, setExporting] = useState(false);
	const [resetOpen, setResetOpen] = useState(false);
	const [isResetting, startResetting] = useTransition();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isDeleting, startDeleting] = useTransition();

	const exportAll = async () => {
		setExporting(true);
		try {
			const result = await exportMyData();
			if (result.success) {
				download(result.filename, result.csv);
			} else {
				toast.error("Couldn't export", { description: result.error });
			}
		} catch {
			toast.error("Couldn't export", { description: "Try again." });
		} finally {
			setExporting(false);
		}
	};

	const resetData = () =>
		startResetting(async () => {
			const result = await resetMyData(RESET_DATA_CONFIRMATION);
			if (!result.success) {
				toast.error("Couldn't reset your data", { description: result.error });
				return;
			}
			setResetOpen(false);
			toast.success("Your data was reset", { description: "Your login, profile and settings are as they were." });
			router.push("/dashboard");
			router.refresh();
		});

	const deleteAccount = () =>
		startDeleting(async () => {
			const result = await deleteMyAccount(DELETE_ACCOUNT_CONFIRMATION);
			if (!result.success) {
				toast.error("Couldn't delete your account", { description: result.error });
				return;
			}
			localStorage.removeItem("sidebarWidth");
			localStorage.removeItem("sidebarCollapsed");
			toast.success("Your account was deleted", { description: "Everything you saved in Pholio is gone." });
			router.replace("/login");
			router.refresh();
		});

	return (
		<SettingsSection
			id="data"
			title="Your data"
			note="Download a copy of what you've saved, start over, or delete your account."
		>
			<SettingRow
				label="Export"
				description={
					isSampleData
						? "Exports and resets are off while you're using sample data."
						: "One CSV file with your accounts, account activity, budget transactions and recurring items, one table after another."
				}
			>
				<Button
					variant="outline"
					onClick={exportAll}
					disabled={exporting || isSampleData}
					className="w-full gap-2 row-wide:w-auto"
				>
					{exporting ? (
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<Download className="h-4 w-4" aria-hidden />
					)}
					Download CSV
				</Button>
			</SettingRow>

			<SettingRow
				label="Reset data"
				description="Deletes your accounts, transactions, budgets, recurring items, presets and contribution room. Your login, profile and settings stay."
			>
				<Button
					variant="outline"
					onClick={() => setResetOpen(true)}
					disabled={isSampleData}
					className="w-full border-warning/50 text-warning hover:bg-warning/10 hover:text-warning row-wide:w-auto"
				>
					Reset data
				</Button>
			</SettingRow>

			<SettingRow
				label="Delete account"
				description="Deletes your login and everything you've saved in Pholio. This can't be undone."
			>
				<Button
					variant="outline"
					onClick={() => setDeleteOpen(true)}
					disabled={isSampleData}
					className="w-full border-error/40 text-error hover:bg-error/10 hover:text-error row-wide:w-auto"
				>
					Delete account
				</Button>
			</SettingRow>

			<DeleteConfirmDialog
				open={resetOpen}
				onOpenChange={setResetOpen}
				title="Reset your data?"
				description="Everything you've saved is deleted for good, and you start again with an empty Pholio. Your login, profile and settings stay. Export anything you want to keep first."
				confirmLabel="Reset data"
				confirmText={RESET_DATA_CONFIRMATION}
				tone="warning"
				pending={isResetting}
				onConfirm={resetData}
			/>

			<DeleteConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title="Delete your account?"
				description="Your accounts, transactions, budgets, recurring items, presets and settings are deleted for good. Export anything you want to keep first."
				confirmLabel="Delete account"
				confirmText={DELETE_ACCOUNT_CONFIRMATION}
				pending={isDeleting}
				onConfirm={deleteAccount}
			/>
		</SettingsSection>
	);
}
