"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Loader2,
	ArrowRight,
	TrendingUp,
	TrendingDown,
	Wallet,
	CreditCard,
	PiggyBank,
	Check,
	AlertTriangle,
	Info,
} from "lucide-react";

import { ProminentAmountInput } from "@/components/ProminentAmountInput";
import { FloatingLabelInput } from "@/components/floating-label-input";
import { MonthPicker } from "@/components/month-picker";
import { CardSelector } from "@/components/CardSelector";
import { FormSection } from "@/components/FormSection";
import { DonutChart } from "@/components/common/DonutChart";
import { EmojiPicker } from "@/components/emoji-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { Banner, BannerClose, BannerIcon, BannerTitle } from "@/components/ui/banner";
import { GuestLogoutAlert } from "@/components/guest-logout-alert";
import { DeleteConfirmDialog } from "@/components/dialogs/DeleteConfirmDialog";
import { WelcomeCelebration } from "@/components/welcome-celebration";
import { MetricCard } from "@/app/dashboard/components/MetricCard";
import { AccountCard } from "@/app/balancesheet/components/AccountCard";
import { BudgetSummaryCards } from "@/app/allocations/components/BudgetSummaryCards";
import { SettingsNav, SettingsNavMobile } from "@/app/settings/components/settings-nav";
import { ServiceLogo } from "@/components/service-logo";
import { ServiceAutocomplete } from "@/components/service-autocomplete";
import { StatusBadge } from "@/components/ui/status-badge";

import {
	MOCK_SERVICE_SUGGESTIONS,
	MOCK_DONUT_DATA,
	MOCK_METRIC_CARD_DATA,
	MOCK_BUDGET_SUMMARY_DATA,
	MOCK_ACCOUNT_DATA,
	MOCK_ACCOUNT_LIABILITY,
} from "./data/mock-data";

export function DemoComponentsClient() {
	const { theme, setTheme } = useTheme();
	const [showScrollToTop, setShowScrollToTop] = React.useState(false);

	React.useEffect(() => {
		const handleScroll = () => {
			setShowScrollToTop(window.scrollY > 300);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const scrollToSection = (sectionId: string) => {
		const element = document.getElementById(sectionId);
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
	};

	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<>
			{/* Sticky Navigation Bar */}
			<nav className="sticky top-0 z-50 bg-background border-b border-border px-6 py-4">
				<div className="max-w-7xl mx-auto flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-primary">Demo Components</h1>
						<p className="text-sm text-primary">Interactive component library</p>
					</div>
					<div className="hidden lg:flex items-center gap-4">
						<a href="#colors-typography" className="text-sm text-primary hover:text-primary transition-colors">
							Colors & Typography
						</a>
						<a href="#ui-buttons-forms" className="text-sm text-primary hover:text-primary transition-colors">
							Buttons & Forms
						</a>
						<a href="#ui-cards-badges" className="text-sm text-primary hover:text-primary transition-colors">
							Cards & Badges
						</a>
						<a href="#custom-components" className="text-sm text-primary hover:text-primary transition-colors">
							Custom Components
						</a>
						<ThemeToggle />
					</div>
				</div>
			</nav>

			{/* Main Content */}
			<main className="flex-1 w-full flex flex-col gap-6 px-4 py-8">
				<div className="max-w-7xl mx-auto w-full space-y-16">
					{/* Section 1: Colors & Typography */}
					<section id="colors-typography" className="space-y-6">
						<div className="space-y-4">
							<h2 className="text-2xl font-bold tracking-tight">Color Palette</h2>
							<p className="text-sm text-primary">
								All CSS custom properties from the theme system. Toggle theme to see both light and dark modes.
							</p>
							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
								{[
									{ name: "background", color: "bg-background" },
									{ name: "border", color: "bg-border border border-border" },
									{ name: "primary", color: "bg-primary text-primary-foreground" },
									{ name: "primary-foreground", color: "bg-primary-foreground text-background" },
									{ name: "secondary", color: "bg-secondary text-secondary-foreground" },
									{ name: "secondary-muted", color: "bg-secondary-muted" },
									{ name: "accent", color: "bg-accent text-accent-foreground" },
									{ name: "accent-muted", color: "bg-accent-muted" },
									{ name: "success", color: "bg-success text-success-foreground" },
									{ name: "success-muted", color: "bg-success-muted" },
									{ name: "warning", color: "bg-warning text-warning-foreground" },
									{ name: "warning-muted", color: "bg-warning-muted" },
									{ name: "error", color: "bg-error text-error-foreground" },
									{ name: "error-muted", color: "bg-error-muted" },
									{ name: "info", color: "bg-info text-info-foreground" },
									{ name: "info-muted", color: "bg-info-muted" },
								].map((color) => (
									<div key={color.name} className="space-y-2">
										<div className={cn("h-20 w-full rounded-lg border border-border", color.color)} />
										<p className="text-xs font-mono text-primary">--{color.name}</p>
									</div>
								))}
							</div>
						</div>

						<div className="space-y-4">
							<h2 className="text-2xl font-bold tracking-tight">Typography</h2>
							<div className="space-y-6">
								<div>
									<h3 className="text-3xl font-bold text-primary">Heading 1</h3>
									<p className="text-sm text-primary">text-3xl font-bold tracking-tight</p>
								</div>
								<div>
									<h2 className="text-2xl font-bold text-primary">Heading 2</h2>
									<p className="text-sm text-primary">text-2xl font-bold tracking-tight</p>
								</div>
								<div>
									<h3 className="text-xl font-semibold text-primary">Heading 3</h3>
									<p className="text-sm text-primary">text-xl font-semibold</p>
								</div>
								<div>
									<h4 className="text-lg font-semibold text-primary">Heading 4</h4>
									<p className="text-sm text-primary">text-lg font-semibold</p>
								</div>
								<div>
									<h5 className="text-base font-medium text-primary">Heading 5</h5>
									<p className="text-sm text-primary">text-base font-medium</p>
								</div>
								<div>
									<h6 className="text-sm font-medium text-primary">Heading 6</h6>
									<p className="text-sm text-primary">text-sm font-medium</p>
								</div>
								<div>
									<p className="text-sm text-primary">Regular body text</p>
									<p className="text-base text-primary">Large body text</p>
									<p className="text-primary text-primary">Muted text</p>
								</div>
							</div>
						</div>
					</section>

					{/* Section 2: UI Components - Buttons & Forms */}
					<section id="ui-buttons-forms" className="space-y-6">
						<div className="space-y-4">
							<h2 className="text-2xl font-bold tracking-tight">Buttons</h2>
							<Card className="p-6 bg-card border border-border space-y-4">
								<div>
									<h3 className="text-lg font-semibold text-primary">Variants</h3>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
										<Button variant="default">Default</Button>
										<Button variant="destructive">Destructive</Button>
										<Button variant="outline">Outline</Button>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
										<Button variant="secondary">Secondary</Button>
										<Button variant="ghost">Ghost</Button>
										<Button variant="link">Link</Button>
									</div>
								</div>
								<div className="space-y-2">
									<h3 className="text-lg font-semibold text-primary">Sizes</h3>
									<div className="flex items-center gap-4 mt-4">
										<Button size="sm">Small</Button>
										<Button>Default</Button>
										<Button size="lg">Large</Button>
										<Button size="icon">
											<Info className="h-4 w-4" />
										</Button>
									</div>
								</div>
								<div className="space-y-2">
									<h3 className="text-lg font-semibold text-primary">States</h3>
									<div className="flex items-center gap-4 mt-4">
										<Button>Normal</Button>
										<Button disabled>Disabled</Button>
										<Button disabled>
											<Loader2 className="h-4 w-4 animate-spin mr-2" />
											Loading
										</Button>
									</div>
								</div>
							</Card>
						</div>

						<div className="space-y-4">
							<h2 className="text-2xl font-bold tracking-tight">Form Components</h2>
							<Card className="p-6 bg-card border border-border space-y-6">
								<div className="space-y-2">
									<Label htmlFor="demo-input" className="text-sm font-medium text-primary">
										Standard Input
									</Label>
									<Input id="demo-input" placeholder="Enter text..." />
								</div>
								<div className="space-y-2">
									<Label htmlFor="demo-select" className="text-sm font-medium text-primary">
										Select Dropdown
									</Label>
									<Select>
										<SelectTrigger id="demo-select">
											<SelectValue placeholder="Select an option" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="option1">Option 1</SelectItem>
											<SelectItem value="option2">Option 2</SelectItem>
											<SelectItem value="option3">Option 3</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-center justify-between">
									<Label className="text-sm font-medium text-primary">Enable feature</Label>
									<Switch />
								</div>
								<div className="space-y-2">
									<Label className="text-sm font-medium text-primary">Slider</Label>
									<Slider defaultValue={[50]} max={100} step={1} />
								</div>
								<div className="space-y-2">
									<Label htmlFor="demo-textarea" className="text-sm font-medium text-primary">
										Textarea
									</Label>
									<Textarea id="demo-textarea" placeholder="Enter your message..." />
								</div>
							</Card>

							{/* Interactive Form Demo */}
							<InteractiveFormDemo />
						</div>
					</section>

					{/* Section 3: UI Components - Cards & Badges */}
					<section id="ui-cards-badges" className="space-y-6">
						<div className="space-y-4">
							<h2 className="text-2xl font-bold tracking-tight">Cards</h2>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<Card className="p-6 bg-card border border-border">
									<h3 className="text-lg font-semibold text-primary mb-2">Basic Card</h3>
									<p className="text-sm text-primary">Simple card with content</p>
								</Card>
								<Card className="p-6 bg-card border border-border hover:shadow-md transition-shadow duration-200">
									<h3 className="text-lg font-semibold text-primary mb-2">Hover Card</h3>
									<p className="text-sm text-primary">Card with hover effect</p>
								</Card>
								<Card className="p-6 bg-card border border-border space-y-4">
									<div>
										<h3 className="text-lg font-semibold text-primary">Card with Header</h3>
										<p className="text-sm text-primary">Header description</p>
									</div>
									<div className="border-t border-border pt-4">
										<p className="text-sm text-primary">Card content area</p>
									</div>
								</Card>
							</div>
						</div>

						<div className="space-y-4">
							<h2 className="text-2xl font-bold tracking-tight">Badges</h2>
							<div className="flex flex-wrap items-center gap-4">
								<Badge variant="default">Default</Badge>
								<Badge variant="secondary">Secondary</Badge>
								<Badge variant="destructive">Destructive</Badge>
								<Badge variant="outline">Outline</Badge>
							</div>
							<div className="space-y-2 mt-4">
								<h3 className="text-lg font-semibold text-primary">Status Badges</h3>
								<div className="flex flex-wrap items-center gap-4">
									<StatusBadge status="paid" />
									<StatusBadge status="partial" />
									<StatusBadge status="unpaid" />
									<StatusBadge status="upcoming" />
									<StatusBadge status="overdue" />
								</div>
							</div>
						</div>
					</section>

					{/* Section 4: Custom Components */}
					<section id="custom-components" className="space-y-6">
						<h2 className="text-2xl font-bold tracking-tight">Custom Components</h2>

						{/* Custom Inputs */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-primary">Custom Inputs</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<Card className="p-6 bg-card border border-border space-y-4">
									<h4 className="text-base font-medium text-primary">ProminentAmountInput</h4>
									<ProminentAmountInput label="Amount" value="0.00" onChange={() => {}} currency="$" />
								</Card>
								<Card className="p-6 bg-card border border-border space-y-4">
									<h4 className="text-base font-medium text-primary">FloatingLabelInput</h4>
									<FloatingLabelInput label="Password" type="password" value="" onChange={() => {}} />
								</Card>
								<Card className="p-6 bg-card border border-border space-y-4">
									<h4 className="text-base font-medium text-primary">MonthPicker</h4>
									<MonthPicker date={new Date()} setDate={() => {}} />
								</Card>
								<Card className="p-6 bg-card border border-border space-y-4">
									<h4 className="text-base font-medium text-primary">CardSelector</h4>
									<CardSelectorDemo />
								</Card>
							</div>
						</div>

						{/* Data Visualization */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-primary">Data Visualization</h3>
							<Card className="p-6 bg-card border-border">
								<h4 className="text-base font-medium text-primary mb-4">DonutChart</h4>
								<div className="flex items-center justify-center">
									<DonutChart
										data={MOCK_DONUT_DATA}
										size={40}
										strokeWidth={12}
										gap={0.5}
										centerContent={
											<div className="text-center">
												<p className="text-xs text-primary">Total</p>
												<p className="text-2xl font-bold text-primary">$200,000</p>
											</div>
										}
										showTooltip={true}
									/>
								</div>
							</Card>
						</div>

						{/* Interactive Components */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-primary">Interactive Components</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<Card className="p-6 bg-card border-border space-y-4">
									<h4 className="text-base font-medium text-primary">EmojiPicker</h4>
									<div className="flex items-center justify-center">
										<EmojiPickerDemo />
									</div>
								</Card>
								<Card className="p-6 bg-card border-border space-y-4">
									<h4 className="text-base font-medium text-primary">ThemeToggle (Expanded)</h4>
									<ThemeToggle />
								</Card>
							</div>
						</div>

						{/* Feature Components */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-primary">Feature Components</h3>
							<div className="space-y-4">
								<MetricCardDemo />
								<BudgetSummaryCardsDemo />
								<AccountCardDemo />
							</div>
						</div>

						{/* Alerts & Dialogs */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-primary">Alerts & Dialogs</h3>
							<div className="space-y-4">
								<BannerDemo />
								<DialogsDemo />
							</div>
						</div>

						{/* Navigation & Utilities */}
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-primary">Navigation & Utilities</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<Card className="p-6 bg-card border-border space-y-4">
									<h4 className="text-base font-medium text-primary">SettingsNav (Desktop)</h4>
									<div className="flex justify-center">
										<SettingsNav />
									</div>
								</Card>
								<Card className="p-6 bg-card border-border space-y-4">
									<h4 className="text-base font-medium text-primary">ServiceLogo</h4>
									<div className="flex flex-wrap items-center justify-center gap-6">
										<ServiceLogo name="Netflix" domain="netflix.com" width={48} height={48} />
										<ServiceLogo name="Unknown" width={48} height={48} />
									</div>
								</Card>
							</div>
							<Card className="p-6 bg-card border-border space-y-4">
								<h4 className="text-base font-medium text-primary">ServiceAutocomplete</h4>
								<ServiceAutocompleteDemo />
							</Card>
						</div>
					</section>

					{/* Section 5: UI Components - Interactive & Layout */}
					<section id="ui-interactive" className="space-y-6">
						<h2 className="text-2xl font-bold tracking-tight">Interactive Components</h2>
						<div className="space-y-6">
							<TabsDemo />
							<TooltipsDemo />
							<ProgressBarsDemo />
							<TogglesDemo />
						</div>
					</section>

					{/* Section 6: UI Components - Dialogs & Modals */}
					<section id="ui-dialogs" className="space-y-6">
						<h2 className="text-2xl font-bold tracking-tight">Dialogs & Modals</h2>
						<MoreDialogsDemo />
					</section>

					{/* Section 7: UI Components - Additional */}
					<section id="ui-additional" className="space-y-6">
						<h2 className="text-2xl font-bold tracking-tight">Additional Components</h2>
						<AdditionalComponentsDemo />
					</section>
				</div>
			</main>

			{/* Scroll to Top Button */}
			{showScrollToTop && (
				<Button className="fixed bottom-6 right-6 rounded-full shadow-lg" size="icon" onClick={scrollToTop}>
					<ChevronUp className="h-4 w-4" />
				</Button>
			)}
		</>
	);
}

function InteractiveFormDemo() {
	const [formData, setFormData] = React.useState({ name: "", email: "", role: "" });
	const [errors, setErrors] = React.useState({ name: "", email: "", role: "" });
	const [isSubmitting, setIsSubmitting] = React.useState(false);

	const validateName = (value: string): boolean => {
		if (!value.trim()) {
			setErrors((prev) => ({ ...prev, name: "Name is required" }));
			return false;
		}
		if (value.length < 2) {
			setErrors((prev) => ({ ...prev, name: "Name must be at least 2 characters" }));
			return false;
		}
		setErrors((prev) => ({ ...prev, name: "" }));
		return true;
	};

	const validateEmail = (value: string): boolean => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!value.trim()) {
			setErrors((prev) => ({ ...prev, email: "Email is required" }));
			return false;
		}
		if (!emailRegex.test(value)) {
			setErrors((prev) => ({ ...prev, email: "Invalid email format" }));
			return false;
		}
		setErrors((prev) => ({ ...prev, email: "" }));
		return true;
	};

	const validateRole = (value: string): boolean => {
		if (!value) {
			setErrors((prev) => ({ ...prev, role: "Please select a role" }));
			return false;
		}
		setErrors((prev) => ({ ...prev, role: "" }));
		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const isNameValid = validateName(formData.name);
		const isEmailValid = validateEmail(formData.email);
		const isRoleValid = validateRole(formData.role);

		if (isNameValid && isEmailValid && isRoleValid) {
			setIsSubmitting(true);
			await new Promise((resolve) => setTimeout(resolve, 1000));
			setIsSubmitting(false);
			toast.success("Form submitted successfully!");
		}
	};

	const handleReset = () => {
		setFormData({ name: "", email: "", role: "" });
		setErrors({ name: "", email: "", role: "" });
	};

	return (
		<Card className="p-6 bg-card border border-border space-y-6">
			<h2 className="text-lg font-semibold text-primary">Interactive Form Demo</h2>
			<form onSubmit={handleSubmit} className="grid gap-4 py-4">
				<div className="grid gap-2">
					<Label htmlFor="form-name">
						Name <span className="text-error">*</span>
					</Label>
					<Input
						id="form-name"
						value={formData.name}
						onChange={(e) => setFormData({ ...formData, name: e.target.value })}
						placeholder="Enter your name"
					/>
					{errors.name && <p className="text-xs text-error">{errors.name}</p>}
				</div>

				<div className="grid gap-2">
					<Label htmlFor="form-email">
						Email <span className="text-error">*</span>
					</Label>
					<Input
						id="form-email"
						type="email"
						value={formData.email}
						onChange={(e) => setFormData({ ...formData, email: e.target.value })}
						placeholder="Enter your email"
					/>
					{errors.email && <p className="text-xs text-error">{errors.email}</p>}
				</div>

				<div className="grid gap-2">
					<Label htmlFor="form-role">
						Role <span className="text-error">*</span>
					</Label>
					<Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
						<SelectTrigger id="form-role">
							<SelectValue placeholder="Select a role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="user">User</SelectItem>
							<SelectItem value="admin">Admin</SelectItem>
						</SelectContent>
					</Select>
					{errors.role && <p className="text-xs text-error">{errors.role}</p>}
				</div>

				<div className="flex gap-2 pt-2">
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
						Submit
					</Button>
					<Button type="button" variant="outline" onClick={handleReset}>
						Reset
					</Button>
				</div>
			</form>
		</Card>
	);
}

function CardSelectorDemo() {
	const [selectedCard, setSelectedCard] = React.useState<string>("option1");

	const cardOptions = [
		{ value: "option1", label: "Option A", icon: "🏠" },
		{ value: "option2", label: "Option B", icon: "💼" },
	];

	return <CardSelector options={cardOptions} value={selectedCard} onChange={setSelectedCard} />;
}

function EmojiPickerDemo() {
	const [selectedEmoji, setSelectedEmoji] = React.useState<string | null>(null);

	return (
		<div className="flex items-center justify-center">
			<EmojiPicker value={selectedEmoji} onSelect={setSelectedEmoji}>
				<Button variant="outline">{selectedEmoji || "Select Emoji"}</Button>
			</EmojiPicker>
		</div>
	);
}

function MetricCardDemo() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<MetricCard
				label="Net Worth"
				value={125000}
				trend={{ direction: "up" as const, value: 12.5, period: "vs last month" }}
				icon={<TrendingUp className="h-4 w-4" />}
				variant="success"
			/>
			<MetricCard
				label="Monthly Income"
				value={8500}
				trend={{ direction: "up" as const, value: 5.2, period: "vs last month" }}
				icon={<Wallet className="h-4 w-4" />}
				variant="info"
			/>
			<MetricCard
				label="Monthly Expenses"
				value={5200}
				trend={{ direction: "down" as const, value: 2.1, period: "vs last month" }}
				icon={<CreditCard className="h-4 w-4" />}
				variant="error"
			/>
			<MetricCard
				label="Monthly Savings"
				value={3300}
				trend={{ direction: "neutral" as const, value: 0.0, period: "vs last month" }}
				icon={<PiggyBank className="h-4 w-4" />}
				variant="warning"
			/>
		</div>
	);
}

function BudgetSummaryCardsDemo() {
	return (
		<BudgetSummaryCards
			expectedIncome={MOCK_BUDGET_SUMMARY_DATA.expectedIncome}
			totalBudgetAllocated={MOCK_BUDGET_SUMMARY_DATA.totalBudgetAllocated}
			totalSpent={MOCK_BUDGET_SUMMARY_DATA.totalSpent}
		/>
	);
}

function AccountCardDemo() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<AccountCard account={MOCK_ACCOUNT_DATA} />
			<AccountCard account={MOCK_ACCOUNT_LIABILITY} />
		</div>
	);
}

function BannerDemo() {
	const [isOpen, setIsOpen] = React.useState(true);

	return (
		<div className="relative">
			<Banner
				open={isOpen}
				onOpenChange={setIsOpen}
				className="bg-primary text-background shadow-lg rounded-full py-2 pl-4 pr-2 border-none"
			>
				<BannerIcon icon={Info} className="text-background/80" />
				<BannerTitle className="text-background">
					<span className="font-semibold">Note:</span> This is a demo banner component with close functionality
				</BannerTitle>
				<BannerClose className="text-background/70 hover:bg-background/20 hover:text-background rounded-full" />
			</Banner>
		</div>
	);
}

function DialogsDemo() {
	const [guestAlertOpen, setGuestAlertOpen] = React.useState(false);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
	const [welcomeOpen, setWelcomeOpen] = React.useState(false);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-4">
				<Button variant="outline" onClick={() => setGuestAlertOpen(true)}>
					Guest Logout Alert
				</Button>
				<Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
					Delete Confirmation
				</Button>
				<Button variant="default" onClick={() => setWelcomeOpen(true)}>
					🎉 Welcome Celebration
				</Button>
			</div>

			<GuestLogoutAlert
				open={guestAlertOpen}
				onOpenChange={setGuestAlertOpen}
				onConfirm={() => {
					toast.success("Logged out (demo)");
					setGuestAlertOpen(false);
				}}
			/>

			<DeleteConfirmDialog
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
				title="Delete this item?"
				description="This action cannot be undone. All data associated with this item will be permanently removed."
				onConfirm={() => {
					toast.success("Item deleted (demo)");
					setDeleteConfirmOpen(false);
				}}
			/>

			{welcomeOpen && <WelcomeCelebration forceOpen={true} redirectUrl="/demo-components" />}
		</div>
	);
}

function ServiceAutocompleteDemo() {
	const [value, setValue] = React.useState("");

	return (
		<ServiceAutocomplete
			value={value}
			onChange={(v) => setValue(v)}
			placeholder="Search for a service (e.g., Netflix, Spotify...)"
		/>
	);
}

function TabsDemo() {
	return (
		<Tabs defaultValue="overview" className="w-full">
			<TabsList className="grid w-full max-w-md grid-cols-3">
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="details">Details</TabsTrigger>
				<TabsTrigger value="settings">Settings</TabsTrigger>
			</TabsList>
			<TabsContent value="overview" className="p-4">
				<p className="text-sm text-primary">Overview content goes here</p>
			</TabsContent>
			<TabsContent value="details" className="p-4">
				<p className="text-sm text-primary">Details content goes here</p>
			</TabsContent>
			<TabsContent value="settings" className="p-4">
				<p className="text-sm text-primary">Settings content goes here</p>
			</TabsContent>
		</Tabs>
	);
}

function TooltipsDemo() {
	return (
		<TooltipProvider>
			<div className="flex items-center gap-6">
				<Tooltip>
					<TooltipTrigger>
						<Button variant="outline">Top</Button>
					</TooltipTrigger>
					<TooltipContent>Tooltip on top</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger>
						<Button variant="outline">Right</Button>
					</TooltipTrigger>
					<TooltipContent side="right">Tooltip on right</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger>
						<Button variant="outline">Bottom</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Tooltip on bottom</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger>
						<Button variant="outline">Left</Button>
					</TooltipTrigger>
					<TooltipContent side="left">Tooltip on left</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	);
}

function ProgressBarsDemo() {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<p className="text-sm text-primary">25% - Success</p>
				<Progress value={25} className="h-2" />
			</div>
			<div className="space-y-2">
				<p className="text-sm text-primary">50% - Info</p>
				<Progress value={50} className="h-2" />
			</div>
			<div className="space-y-2">
				<p className="text-sm text-primary">75% - Warning</p>
				<Progress value={75} className="h-2" />
			</div>
			<div className="space-y-2">
				<p className="text-sm text-primary">100% - Complete</p>
				<Progress value={100} className="h-2" />
			</div>
		</div>
	);
}

function TogglesDemo() {
	const [toggleValue, setToggleValue] = React.useState(true);
	const [toggleGroupValue, setToggleGroupValue] = React.useState("option1");

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<Label className="text-sm font-medium text-primary">Toggle Switch</Label>
				<Switch checked={toggleValue} onCheckedChange={setToggleValue} />
			</div>
			<div className="space-y-2">
				<Label className="text-sm font-medium text-primary">Toggle Group</Label>
				<ToggleGroup type="single" value={toggleGroupValue} onValueChange={setToggleGroupValue}>
					<ToggleGroupItem value="option1">Option 1</ToggleGroupItem>
					<ToggleGroupItem value="option2">Option 2</ToggleGroupItem>
					<ToggleGroupItem value="option3">Option 3</ToggleGroupItem>
				</ToggleGroup>
			</div>
		</div>
	);
}

function MoreDialogsDemo() {
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [alertDialogOpen, setAlertDialogOpen] = React.useState(false);

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-4">
				<Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
				<Button variant="outline" onClick={() => setAlertDialogOpen(true)}>
					Open Alert Dialog
				</Button>
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-[425px]" showCloseButton={true}>
					<DialogHeader>
						<DialogTitle>Dialog Title</DialogTitle>
						<DialogDescription>This is a dialog description text that provides context.</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<p className="text-sm text-primary">
							Dialog content goes here. You can add forms, information, or any other content.
						</p>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={() => setDialogOpen(false)}>Confirm</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. Please confirm you want to proceed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => setAlertDialogOpen(false)}>Continue</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function AdditionalComponentsDemo() {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Card className="p-6 bg-card border-border space-y-4">
					<h3 className="text-lg font-semibold text-primary">Avatars</h3>
					<div className="flex items-center gap-4">
						<Avatar>
							<AvatarImage src="https://i.pravatar.cc/150?img=1" alt="User" />
							<AvatarFallback>JD</AvatarFallback>
						</Avatar>
						<Avatar>
							<AvatarFallback>AB</AvatarFallback>
						</Avatar>
					</div>
				</Card>
				<Card className="p-6 bg-card border-border space-y-4">
					<h3 className="text-lg font-semibold text-primary">Skeletons</h3>
					<div className="space-y-3">
						<Skeleton className="h-12 w-12 rounded-lg" />
						<div className="space-y-2">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-4 w-1/2" />
							<Skeleton className="h-4 w-5/6" />
						</div>
					</div>
				</Card>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Card className="p-6 bg-card border-border space-y-4">
					<h3 className="text-lg font-semibold text-primary">Separators</h3>
					<div className="space-y-4">
						<div className="flex items-center gap-4">
							<span className="text-sm text-primary">Left</span>
							<Separator orientation="vertical" className="h-6" />
							<span className="text-sm text-primary">Right</span>
						</div>
						<div className="space-y-2">
							<span className="text-sm text-primary">Top</span>
							<Separator className="h-px" />
							<span className="text-sm text-primary">Bottom</span>
						</div>
					</div>
				</Card>
				<Card className="p-6 bg-card border-border space-y-4">
					<h3 className="text-lg font-semibold text-primary">Alerts</h3>
					<div className="space-y-4">
						<Alert>
							<AlertTitle>Default Alert</AlertTitle>
							<AlertDescription>This is a default alert message for general information.</AlertDescription>
						</Alert>
						<Alert variant="destructive">
							<AlertTitle>Destructive Alert</AlertTitle>
							<AlertDescription>This is a destructive alert for error or critical information.</AlertDescription>
						</Alert>
					</div>
				</Card>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<Card className="p-6 bg-card border-border space-y-4">
					<h3 className="text-lg font-semibold text-primary">Popovers</h3>
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline">Click me</Button>
						</PopoverTrigger>
						<PopoverContent>
							<div className="space-y-2">
								<p className="text-sm text-primary">Popover content</p>
								<Button size="sm">Action</Button>
							</div>
						</PopoverContent>
					</Popover>
				</Card>
				<Card className="p-6 bg-card border-border space-y-4">
					<h3 className="text-lg font-semibold text-primary">Dropdown Menu</h3>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">Options</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuItem onClick={() => toast.info("Edit clicked")}>Edit</DropdownMenuItem>
							<DropdownMenuItem onClick={() => toast.info("Share clicked")}>Share</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => toast.info("Delete clicked")} className="text-error">
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</Card>
			</div>
		</div>
	);
}

