export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			users: {
				Row: {
					id: string;
					email: string;
					full_name: string | null;
					avatar_url: string | null;
					default_expected_income: number;
					timezone: string | null;
					default_currency: string;
					locale: string;
					notify_email: boolean;
					notify_lead_days: number;
					notify_in_app: boolean;
					changelog_seen_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					email: string;
					full_name?: string | null;
					avatar_url?: string | null;
					default_expected_income?: number;
					timezone?: string | null;
					default_currency?: string;
					locale?: string;
					notify_email?: boolean;
					notify_lead_days?: number;
					notify_in_app?: boolean;
					changelog_seen_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					full_name?: string | null;
					avatar_url?: string | null;
					default_expected_income?: number;
					timezone?: string | null;
					default_currency?: string;
					locale?: string;
					notify_email?: boolean;
					notify_lead_days?: number;
					notify_in_app?: boolean;
					changelog_seen_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			transactions: {
				Row: {
					id: string;
					user_id: string;
					category_id: string | null;
					name: string;
					amount: number;
					transaction_date: string;
					source: string;
					notes: string | null;
					created_at: string;
					updated_at: string;
					recurring_expense_id: string | null;
					covers_due_date: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					category_id?: string | null;
					name: string;
					amount: number;
					transaction_date: string;
					source: string;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
					recurring_expense_id?: string | null;
					covers_due_date?: string | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					category_id?: string | null;
					name?: string;
					amount?: number;
					transaction_date?: string;
					source?: string;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
					recurring_expense_id?: string | null;
					covers_due_date?: string | null;
				};
			};
			recurring_expenses: {
				Row: {
					id: string;
					user_id: string;
					name: string;
					amount: number;
					currency: string | null;
					billing_period: string;
					next_due_date: string;
					category: string;
					budget_category: string | null;
					account_id: string | null;
					is_active: boolean | null;
					service_provider: string | null;
					meta_data: Json | null;
					created_at: string | null;
					updated_at: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					name: string;
					amount: number;
					currency?: string | null;
					billing_period: string;
					next_due_date: string;
					category: string;
					budget_category?: string | null;
					account_id?: string | null;
					is_active?: boolean | null;
					service_provider?: string | null;
					meta_data?: Json | null;
					created_at?: string | null;
					updated_at?: string | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					name?: string;
					amount?: number;
					currency?: string | null;
					billing_period?: string;
					next_due_date?: string;
					category?: string;
					budget_category?: string | null;
					account_id?: string | null;
					is_active?: boolean | null;
					service_provider?: string | null;
					meta_data?: Json | null;
					created_at?: string | null;
					updated_at?: string | null;
				};
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
	};
}
