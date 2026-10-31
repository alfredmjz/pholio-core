export interface RoomBalanceState {
	tracksRoom: boolean;
	balance: number;
}

/**
 * A room-tracked account counts money it receives as a deposit. Setting a higher balance
 * (opening balance or an edit) puts money in without a ledger row, so the increase is
 * recorded as one. Turning tracking on records the part of the balance its ledger rows don't
 * explain (`ledgerNet`, the sum of its rows), since rows already count on their own.
 * A lower balance records nothing: a drop could be a loss, not a withdrawal.
 */
export function balanceIncreaseDeposit(
	before: RoomBalanceState,
	after: RoomBalanceState,
	ledgerNet = 0
): number | null {
	if (!after.tracksRoom) return null;
	const counted = before.tracksRoom ? before.balance : ledgerNet;
	const increase = Math.round((after.balance - counted) * 100) / 100;
	return increase > 0 ? increase : null;
}
