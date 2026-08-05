import { Database } from "@/lib/database.types";
import { AccountWithType } from "@/app/balancesheet/types";

export type RecurringTransferStatus = "paid" | "upcoming" | "overdue" | "due_today";

export type RecurringTransfer = Database["public"]["Tables"]["recurring_transfers"]["Row"] & {
	source_account?: AccountWithType;
	destination_account?: AccountWithType;
	status?: RecurringTransferStatus;
};

export type NewRecurringTransfer = Omit<
	Database["public"]["Tables"]["recurring_transfers"]["Insert"],
	"id" | "user_id" | "created_at" | "updated_at"
>;
