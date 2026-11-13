"use server";

import { getReadContext } from "@/lib/data-context.server";
import { Logger } from "@/lib/logger";
import type { Weather } from "@/lib/financial-weather";
import { weatherStore } from "./weather-store";

/** Today's weather for the signed-in user, or null when nobody is signed in. Reads only. */
export async function getFinancialWeather(): Promise<Weather | null> {
	try {
		const ctx = await getReadContext();
		return ctx ? await weatherStore(ctx).today() : null;
	} catch (error) {
		// The backdrop is decoration: a failure here must never break the page.
		Logger.error("Weather: could not compute", { error });
		return "cloudy";
	}
}
