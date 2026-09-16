function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** How much granted repair credit can still be clawed back from available wallet balance. */
export function revocableRepairCreditUsd(grantedUsd: number, walletBalanceUsd: number): number {
  if (!Number.isFinite(grantedUsd) || !Number.isFinite(walletBalanceUsd)) return 0
  return roundMoney(Math.max(0, Math.min(grantedUsd, walletBalanceUsd)))
}
