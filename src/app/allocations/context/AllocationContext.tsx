"use client";

import { createContext, useContext, ReactNode } from "react";
import type { AllocationCategory, AllocationSummary } from "../types";

interface AllocationContextValue {
	optimisticallyReorderCategories: (newCategories: any[]) => void;
	rollback: (previousSummary: AllocationSummary) => void;
	saveCategoryOrder: (newCategories: AllocationCategory[]) => Promise<boolean>;
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
