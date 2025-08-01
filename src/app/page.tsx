import { fetchData } from '@/utils/supabase/client';

export default async function HomePage() {
	const data = await fetchData('test');

	if (!data) {
		return <p>Failed to load data</p>;
	}

	return (
		<div>
			<h1>Data from Supabase</h1>
			<pre>{JSON.stringify(data, null, 2)}</pre>
		</div>
	);
}

