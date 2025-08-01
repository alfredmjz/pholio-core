import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export async function fetchData(table: string) {
	const { data, error } = await supabase.from(table).select("*");
	if (error) {
		console.error("Error fetching data:", error);
		return null;
	}
	return data;
}

export async function insertData(table: string, payload: any) {
	const { data, error } = await supabase.from(table).insert(payload);
	if (error) {
		console.error("Error inserting data:", error);
		return null;
	}
	return data;
}

export async function updateData(table: string, id: string, payload: any) {
	const { data, error } = await supabase.from(table).update(payload).eq("id", id);
	if (error) {
		console.error("Error updating data:", error);
		return null;
	}
	return data;
}

export async function deleteData(table: string, id: string) {
	const { data, error } = await supabase.from(table).delete().eq("id", id);
	if (error) {
		console.error("Error deleting data:", error);
		return null;
	}
	return data;
}

export { supabase };

