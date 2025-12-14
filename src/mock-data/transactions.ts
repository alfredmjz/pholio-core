export interface Transaction {
	id: string;
	date: string;
	description: string;
	amount: number;
	category: string;
	type: "income" | "expense";
	status: "pending" | "completed";
}

export const mockTransactions: Transaction[] = [
	{
		id: "t1",
		date: new Date().toISOString(),
		description: "Grocery Store",
		amount: 125.5,
		category: "Food",
		type: "expense",
		status: "completed",
	},
	{
		id: "t2",
		date: new Date(Date.now() - 86400000).toISOString(),
		description: "Monthly Salary",
		amount: 5000.0,
		category: "Income",
		type: "income",
		status: "completed",
	},
	{
		id: "t3",
		date: new Date(Date.now() - 172800000).toISOString(),
		description: "Electric Bill",
		amount: 85.0,
		category: "Utilities",
		type: "expense",
		status: "completed",
	},
	{
		id: "t4",
		date: new Date(Date.now() - 259200000).toISOString(),
		description: "Coffee Shop",
		amount: 5.75,
		category: "Food",
		type: "expense",
		status: "pending",
	},
];
