import { DashboardData } from "./types";

export const sampleDashboardData: DashboardData = {
	metrics: {
		netWorth: {
			label: "Net Worth",
			value: 125000,
			trend: {
				value: 5.2,
				direction: "up",
				period: "vs last month",
			},
			variant: "default",
		},
		monthlyIncome: {
			label: "Monthly Income",
			value: 8500,
			trend: {
				value: 2.1,
				direction: "up",
				period: "vs last month",
			},
			variant: "success",
		},
		monthlyExpenses: {
			label: "Monthly Expenses",
			value: 4200,
			trend: {
				value: 1.5,
				direction: "down",
				period: "vs last month",
			},
			variant: "default",
		},
		savingsRate: {
			label: "Savings Rate",
			value: 50.5,
			trend: {
				value: 3.2,
				direction: "up",
				period: "vs last month",
			},
			variant: "success",
		},
	},
	cashflow: {
		month: {
			totalIncome: 8500,
			totalExpenses: 4200,
			netCashflow: 4300,
			period: "month",
			data: [
				{ date: "2024-01-01", label: "Week 1", income: 2000, expenses: 1000 },
				{ date: "2024-01-08", label: "Week 2", income: 2100, expenses: 1200 },
				{ date: "2024-01-15", label: "Week 3", income: 2200, expenses: 900 },
				{ date: "2024-01-22", label: "Week 4", income: 2200, expenses: 1100 },
			],
		},
		quarter: {
			totalIncome: 25500,
			totalExpenses: 12600,
			netCashflow: 12900,
			period: "quarter",
			data: [
				{ date: "2023-11", label: "Nov", income: 8200, expenses: 4000 },
				{ date: "2023-12", label: "Dec", income: 8300, expenses: 4400 },
				{ date: "2024-01", label: "Jan", income: 8500, expenses: 4200 },
			],
		},
		year: {
			totalIncome: 102000,
			totalExpenses: 48000,
			netCashflow: 54000,
			period: "year",
			data: [
				{ date: "2023", label: "2023", income: 98000, expenses: 45000 },
				{ date: "2024", label: "2024", income: 4000, expenses: 3000 }, // YTD logic simplified
			],
		},
	},
	netWorth: {
		netWorth: 125000,
		totalAssets: 150000,
		totalLiabilities: 25000,
		trend: {
			value: 12,
			direction: "up",
			period: "vs last year",
		},
		assetBreakdown: [
			{
				category: "Cash & Equivalents",
				value: 30000,
				accounts: [
					{ name: "Checking Account", value: 5000 },
					{ name: "Savings Account", value: 25000 },
				],
			},
			{
				category: "Investments",
				value: 120000,
				accounts: [
					{ name: "401k", value: 80000 },
					{ name: "Roth IRA", value: 20000 },
					{ name: "Brokerage", value: 20000 },
				],
			},
		],
		liabilityBreakdown: [
			{
				category: "Loans",
				value: 25000,
				accounts: [
					{ name: "Student Loan", value: 15000 },
					{ name: "Car Loan", value: 10000 },
				],
			},
		],
		trendData: [
			{ date: "2023-08", value: 110000 },
			{ date: "2023-09", value: 112000 },
			{ date: "2023-10", value: 115000 },
			{ date: "2023-11", value: 118000 },
			{ date: "2023-12", value: 122000 },
			{ date: "2024-01", value: 125000 },
		],
	},
	recentTransactions: [
		{
			id: "tx-1",
			date: "2024-01-25",
			description: "Whole Foods Market",
			category: "Groceries",
			amount: 154.32,
			type: "expense",
			account: "Credit Card",
		},
		{
			id: "tx-2",
			date: "2024-01-24",
			description: "Uber Ride",
			category: "Transportation",
			amount: 24.5,
			type: "expense",
			account: "Credit Card",
		},
		{
			id: "tx-3",
			date: "2024-01-23",
			description: "Salary Deposit",
			category: "Income",
			amount: 4250.0,
			type: "income",
			account: "Checking",
		},
		{
			id: "tx-4",
			date: "2024-01-22",
			description: "Netflix Subscription",
			category: "Entertainment",
			amount: 15.99,
			type: "expense",
			account: "Credit Card",
		},
		{
			id: "tx-5",
			date: "2024-01-20",
			description: "Electric Bill",
			category: "Utilities",
			amount: 125.0,
			type: "expense",
			account: "Checking",
		},
	],
};
