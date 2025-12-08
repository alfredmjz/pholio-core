import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Fetches all records from a specified table.
 *
 * @param table - Name of the database table
 * @returns Array of records or null if error occurs
 */
export async function fetchData(table: string) {
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
export async function insertData(table: string, payload: any) {
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
export async function updateData(table: string, id: string, payload: any) {
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
