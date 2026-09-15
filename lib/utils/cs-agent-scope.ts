export type CsAgentOrderScope = {
  linkedOrderId: string | null
  requesterUserId: string | null
}

export function csAgentEmailsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = left?.trim().toLowerCase() ?? ""
  const b = right?.trim().toLowerCase() ?? ""
  return Boolean(a && a === b)
}

export function csAgentOrderIsInScope(
  order: { id: string; buyerId: string | null; sellerId: string | null },
  scope: CsAgentOrderScope,
): boolean {
  if (scope.linkedOrderId && order.id === scope.linkedOrderId) return true
  if (scope.requesterUserId) {
    return order.buyerId === scope.requesterUserId || order.sellerId === scope.requesterUserId
  }
  return false
}
