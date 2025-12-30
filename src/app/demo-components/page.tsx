import { requireAuth } from "@/lib/auth";
import { DemoComponentsClient } from "./client";

export const metadata = {
	title: "Demo Components | Pholio",
	description: "Interactive component library showcase",
};

export default async function DemoComponentsPage() {
	await requireAuth();

	return <DemoComponentsClient />;
}
