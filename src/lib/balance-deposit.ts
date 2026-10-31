/**
 * A room-tracked account counts money it receives as a deposit. Setting a higher balance
 * (opening balance or an edit) puts money in without a ledger row, so the increase is
 * recorded as one. A lower balance records nothing: a drop could be a loss, not a withdrawal.
 */
export function balanceIncreaseDeposit(tracksRoom: boolean, previousBalance: number, newBalance: number): number | null {
	if (!tracksRoom) return null;
	const increase = Math.round((newBalance - previousBalance) * 100) / 100;
	return increase > 0 ? increase : null;
}
