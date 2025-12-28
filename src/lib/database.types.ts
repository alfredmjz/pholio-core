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
					is_guest: boolean;
					guest_name: string | null;
					has_seen_welcome: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					email: string;
					full_name?: string | null;
					avatar_url?: string | null;
					is_guest?: boolean;
					guest_name?: string | null;
					has_seen_welcome?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					full_name?: string | null;
					avatar_url?: string | null;
					is_guest?: boolean;
					guest_name?: string | null;
					has_seen_welcome?: boolean;
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
					external_id: string | null;
					notes: string | null;
					created_at: string;
					updated_at: string;
					recurring_expense_id: string | null;
				};
				Insert: {
					id?: string;
					user_id: string;
					category_id?: string | null;
					name: string;
					amount: number;
					transaction_date: string;
					source: string;
					external_id?: string | null;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
					recurring_expense_id?: string | null;
				};
				Update: {
					id?: string;
					user_id?: string;
					category_id?: string | null;
					name?: string;
					amount?: number;
					transaction_date?: string;
					source?: string;
					external_id?: string | null;
					notes?: string | null;
					created_at?: string;
					updated_at?: string;
					recurring_expense_id?: string | null;
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
					is_active: boolean | null;
					service_provider: string | null;
					plaid_stream_id: string | null;
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
					is_active?: boolean | null;
					service_provider?: string | null;
					plaid_stream_id?: string | null;
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
					is_active?: boolean | null;
					service_provider?: string | null;
					plaid_stream_id?: string | null;
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
