import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use a global variable to store the Supabase client during development
// to prevent multiple instances from being created during hot-reloading.
const globalAny = globalThis as any;

const supabase =
	process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true"
		? (new Proxy(
				{},
				{
					get: () => {
						// Return a dummy object that allows chaining but does nothing
						const dummy: any = () => dummy;
						// Add common properties to avoid basic crashes
						dummy.select = () => dummy;
						dummy.insert = () => dummy;
						dummy.update = () => dummy;
						dummy.delete = () => dummy;
						dummy.eq = () => dummy;
						dummy.single = () => Promise.resolve({ data: null, error: null });
						dummy.then = (resolve: any) => resolve({ data: null, error: null });
						// Auth mock
						dummy.auth = {
							getUser: () => Promise.resolve({ data: { user: null }, error: null }),
							getSession: () => Promise.resolve({ data: { session: null }, error: null }),
							onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
						};
						return dummy;
					},
				}
			) as any)
		: (globalAny.supabase ?? createBrowserClient(supabaseUrl, supabaseAnonKey));

if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_SAMPLE_DATA !== "true") {
	globalAny.supabase = supabase;
}

/**
 * Fetches all records from a specified table.
 *
 * @param table - Name of the database table
 * @returns Array of records or null if error occurs
 */
export async function fetchData(table: string) {
	if (process.env.NEXT_PUBLIC_USE_SAMPLE_DATA === "true") return [];
	const { data, error } = await supabase.from(table).select("*");
	if (error) {
		console.error("Error fetching data:", error);
		return null;
	}
	return data;
}

/**
 * Inserts a new record into a specified table.
 *
 * @param table - Name of the database table
 * @param payload - Data to insert
 * @returns Inserted record or null if error occurs
 */
export async function insertData(table: string, payload: Record<string, unknown>) {
	const { data, error } = await supabase.from(table).insert(payload);
	if (error) {
		console.error("Error inserting data:", error);
		return null;
	}
	return data;
}

/**
 * Updates an existing record in a specified table.
 *
 * @param table - Name of the database table
 * @param id - ID of the record to update
 * @param payload - Data to update
 * @returns Updated record or null if error occurs
 */
export async function updateData(table: string, id: string, payload: Record<string, unknown>) {
	const { data, error } = await supabase.from(table).update(payload).eq("id", id);
	if (error) {
		console.error("Error updating data:", error);
		return null;
	}
	return data;
}

/**
 * Deletes a record from a specified table.
 *
 * @param table - Name of the database table
 * @param id - ID of the record to delete
 * @returns Deleted record or null if error occurs
 */
export async function deleteData(table: string, id: string) {
	const { data, error } = await supabase.from(table).delete().eq("id", id);
	if (error) {
		console.error("Error deleting data:", error);
		return null;
	}
	return data;
}

export { supabase };
