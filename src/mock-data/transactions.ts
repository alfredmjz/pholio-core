import { getDemoNow } from "./demo-date";

export interface Transaction {
	id: string;
	user_id: string;
	category_id: string;
	name: string;
	amount: number;
	transaction_date: string;
	source: string;
	external_id: string;
	notes: string | null;
	created_at: string;
	updated_at: string;
	recurring_expense_id: string | null;
}

export function getMockTransactions(now: Date = getDemoNow()): Transaction[] {
	const y = now.getFullYear();
	const m = now.getMonth();
	const iso = now.toISOString();
	return [
    {
        id: "tx-1",
        user_id: "mock-user",
        category_id: "cat-1",
        name: "Netflix", // Auto-match case (Name matches 'Netflix')
        amount: -15.99,
        transaction_date: new Date(y, m, 15).toISOString(),
        source: "check",
        external_id: "ext-1",
        notes: null,
        created_at: iso,
        updated_at: iso,
        recurring_expense_id: null // Should match by name "Netflix"
    },
    {
        id: "tx-2",
        user_id: "mock-user",
        category_id: "cat-2",
        name: "SPOTIFY USA", // Auto-match case (Name 'Spotify' in 'SPOTIFY USA')
        amount: -9.99,
        transaction_date: new Date(y, m, 28).toISOString(),
        source: "check",
        external_id: "ext-2",
        notes: null,
        created_at: iso,
        updated_at: iso,
        recurring_expense_id: null
    },
    {
        id: "tx-manual-1",
        user_id: "mock-user",
        category_id: "cat-manual",
        name: "WEIRD_BANK_DESC_123", // Manual Link Case: Name doesn't match 'Gym Membership'
        amount: -50.00,
        transaction_date: new Date(y, m, 1).toISOString(),
        source: "check",
        external_id: "ext-manual-1",
        notes: "Manual link to Gym",
        created_at: iso,
        updated_at: iso,
        recurring_expense_id: "mock-3" // Linked to Gym Membership ($50)
    },
    {
        id: "tx-split-1",
        user_id: "mock-user",
        category_id: "cat-split",
        name: "Rent Payment 1", // Split Payment Case (Part 1)
        amount: -600.00,
        transaction_date: new Date(y, m, 1).toISOString(),
        source: "check",
        external_id: "ext-split-1",
        notes: null,
        created_at: iso,
        updated_at: iso,
        recurring_expense_id: "mock-4" // Linked to Rent ($1200)
    },
    {
        id: "tx-split-2",
        user_id: "mock-user",
        category_id: "cat-split",
        name: "Rent Payment 2", // Split Payment Case (Part 2)
        amount: -600.00,
        transaction_date: new Date(y, m, 2).toISOString(),
        source: "check",
        external_id: "ext-split-2",
        notes: null,
        created_at: iso,
        updated_at: iso,
        recurring_expense_id: "mock-4" // Linked to Rent ($1200) -> Total $1200 (Paid)
    },
    {
        id: "tx-partial-1",
        user_id: "mock-user",
        category_id: "cat-partial",
        name: "Partial Utility Pmt",
        amount: -20.00, // Only $20 of $85
        transaction_date: new Date(y, m, 20).toISOString(),
        source: "check",
        external_id: "ext-partial-1",
        notes: null,
        created_at: iso,
        updated_at: iso,
        recurring_expense_id: "mock-5" // Linked to Electricity Bill ($85) -> Status should be 'partial'
    }
	];
}
