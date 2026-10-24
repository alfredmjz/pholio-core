"use client";

import { createContext, useContext } from "react";
import { DEFAULT_FORMAT_SETTINGS, setFormatSettings, type FormatSettings } from "@/lib/format";

const FormatContext = createContext<FormatSettings>(DEFAULT_FORMAT_SETTINGS);

interface FormatProviderProps {
	settings: FormatSettings;
	children: React.ReactNode;
}

/** Applies the user's number, date and currency format to every formatter below it. */
export function FormatProvider({ settings, children }: FormatProviderProps) {
	setFormatSettings(settings);
	return <FormatContext.Provider value={settings}>{children}</FormatContext.Provider>;
}

/**
 * Re-applies the signed-in user's format. The server renders many users' pages at once and
 * finishes streamed parts later, so each page root calls this before it formats anything.
 */
export function useFormatSettings(): FormatSettings {
	const settings = useContext(FormatContext);
	setFormatSettings(settings);
	return settings;
}
