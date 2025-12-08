"use client";

import { createContext, useContext, ReactNode } from "react";
import type { AllocationSummary } from "../types";

interface AllocationContextValue {
	optimisticallyUpdateBudget: (categoryId: string, newBudget: number) => void;
	optimisticallyUpdateName: (categoryId: string, newName: string) => void;
	optimisticallyDeleteCategory: (categoryId: string) => void;
	rollback: (previousSummary: AllocationSummary) => void;
}

const AllocationContext = createContext<AllocationContextValue | null>(null);

export function AllocationProvider({ children, value }: { children: ReactNode; value: AllocationContextValue }) {
	return <AllocationContext.Provider value={value}>{children}</AllocationContext.Provider>;
}

export function useAllocationContext() {
	const context = useContext(AllocationContext);
	if (!context) {
		throw new Error("useAllocationContext must be used within AllocationProvider");
	}
	return context;
}
