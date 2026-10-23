import type { AccountTypeCode, AccountWithType } from "@/app/accounts/types";
import { selectUpcomingBills, type BillInput } from "@/app/dashboard/heads-up";
import type { WeatherInput } from "@/lib/financial-weather";

const CASH_CODES: AccountTypeCode[] = ["chequing", "savings"];
const CREDIT_CODES: AccountTypeCode[] = ["credit_card", "line_of_credit"];
/** Far enough ahead to cover any pay cycle. */
const OPEN_BILL_WINDOW_DAYS = 62;

function codeOf(account: AccountWithType): AccountTypeCode | null {
	return account.account_type?.code ?? null;
}

export function accountsForWeather(accounts: AccountWithType[]): Pick<WeatherInput, "cards" | "liquidCash"> {
	const cash = accounts.filter((account) => {
		const code = codeOf(account);
		return code !== null && CASH_CODES.includes(code);
	});
	const cards = accounts
		.filter((account) => {
			const code = codeOf(account);
			return code !== null && CREDIT_CODES.includes(code) && Number(account.credit_limit) > 0;
		})
		.map((account) => ({ balance: Number(account.current_balance), limit: Number(account.credit_limit) }));

	return {
		cards,
		liquidCash: cash.length > 0 ? cash.reduce((sum, account) => sum + Number(account.current_balance), 0) : null,
	};
}

export function billsForWeather(
	bills: BillInput[],
	today: string
): Pick<WeatherInput, "hasBills" | "overdueBills" | "openBills"> {
	const open = selectUpcomingBills(bills, today, OPEN_BILL_WINDOW_DAYS);
	return {
		hasBills: bills.some((bill) => bill.isActive !== false),
		overdueBills: open.filter((bill) => bill.daysUntil < 0).length,
		openBills: open.map((bill) => ({ dueDate: bill.dueDate, amount: bill.amount })),
	};
}
