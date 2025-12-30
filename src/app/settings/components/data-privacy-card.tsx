"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertCircle, Download, Trash2 } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DataPrivacyCard() {
	// Local state for UI toggles
	const [improvePholio, setImprovePholio] = useState(true);
	const [personalizedInsights, setPersonalizedInsights] = useState(true);
	const [anonymousBenchmarking, setAnonymousBenchmarking] = useState(false);

	const handleRequestData = () => {
		toast.success("Data request submitted. We'll email you when it's ready.");
	};

	const handleDeleteAccount = () => {
		// In a real app, this would trigger a server action
		toast.error("Account deletion is not available in the demo.");
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Data Usage Section */}
			<Card>
				<CardHeader>
					<CardTitle>How we use your data</CardTitle>
					<CardDescription>Manage how Pholio processes your financial data to improve your experience.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="flex items-center justify-between space-x-4">
						<div className="space-y-1">
							<Label className="text-base leading-none">Use data to improve Pholio</Label>
							<p className="text-sm text-primary">
								Allows us to process usage logs and error reports to understand system performance and improve our
								services.
							</p>
						</div>
						<Switch checked={improvePholio} onCheckedChange={setImprovePholio} />
					</div>

					<div className="flex items-center justify-between space-x-4">
						<div className="space-y-1">
							<Label className="text-base leading-none">Personalized Insights</Label>
							<p className="text-sm text-primary">
								Allows us to analyze your transaction history to generate personalized budget tips and spending alerts.
							</p>
						</div>
						<Switch checked={personalizedInsights} onCheckedChange={setPersonalizedInsights} />
					</div>

					<div className="flex items-center justify-between space-x-4">
						<div className="space-y-1">
							<Label className="text-base leading-none">Anonymous Benchmarking</Label>
							<p className="text-sm text-primary">
								Contribute anonymous aggregated data to community averages. This lets you compare your spending habits
								with similar profiles.
							</p>
						</div>
						<Switch checked={anonymousBenchmarking} onCheckedChange={setAnonymousBenchmarking} />
					</div>
				</CardContent>
			</Card>

			{/* Data Export Section */}
			<Card>
				<CardHeader>
					<CardTitle>Request your data</CardTitle>
					<CardDescription>
						Get a copy of all the personal and financial data we store for your account.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="rounded-md bg-secondary/50 p-4">
							<div className="flex items-start gap-4">
								<AlertCircle className="h-5 w-5 mt-0.5 text-primary" />
								<div className="space-y-1">
									<p className="text-sm font-medium">Data Export Process</p>
									<p className="text-sm text-primary">
										Your data export will include your profile information, transaction history, and budget
										configurations. The file will be available for download for 7 days.
									</p>
								</div>
							</div>
						</div>
						<Button variant="outline" onClick={handleRequestData} className="w-full sm:w-auto">
							<Download className="mr-2 h-4 w-4" />
							Request My Data
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Danger Zone */}
			<Card className="border-error/30">
				<CardHeader>
					<CardTitle className="text-error">Danger Zone</CardTitle>
					<CardDescription>Irreversible actions for your account.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="space-y-1">
								<Label className="text-base">Delete Account</Label>
								<p className="text-sm text-primary">Permanently delete your account and all associated data.</p>
							</div>

							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button variant="destructive">Delete Account</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
										<AlertDialogDescription>
											This action cannot be undone. This will permanently delete your account and remove your data from
											our servers.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction onClick={handleDeleteAccount} className="bg-error hover:bg-error/90">
											Yes, delete my account
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
