import { z } from "zod";

/** Row ids. Demo rows use readable ids ("acc-4"), so this is not limited to UUIDs. */
export const idSchema = z.string().min(1, "Missing id.");

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

export const moneySchema = z.number().finite("Enter a valid amount.");

export const nonNegativeMoneySchema = moneySchema.nonnegative("Amount can't be negative.");

export const displayOrderSchema = z.array(z.object({ id: idSchema, display_order: z.number().int() }));
