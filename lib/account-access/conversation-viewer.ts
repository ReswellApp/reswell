export interface ConversationViewerIdentity {
  allowed: boolean
  senderId: string
  viewerId: string
  /** Shop members send as the shop account, which their own JWT cannot insert. */
  useServiceRole: boolean
}

/**
 * Buyer and seller logins keep their own id.
 * An active shop member with message access speaks as that shop's seller id.
 */
export function conversationViewerIdentity(input: {
  actorUserId: string
  buyerId: string
  sellerId: string
  shopAccountId: string
  canReadMessages: boolean
  canWriteMessages: boolean
}): ConversationViewerIdentity {
  const actorId = input.actorUserId.trim()
  const buyerId = input.buyerId.trim()
  const sellerId = input.sellerId.trim()
  const self = {
    allowed: true,
    senderId: actorId,
    viewerId: actorId,
    useServiceRole: false,
  } as const

  if (actorId && (actorId === buyerId || actorId === sellerId)) return self

  const actsForSeller =
    input.canReadMessages &&
    input.shopAccountId === sellerId &&
    actorId !== sellerId &&
    actorId.length > 0 &&
    sellerId.length > 0

  if (!actsForSeller) {
    return {
      allowed: false,
      senderId: actorId,
      viewerId: actorId,
      useServiceRole: false,
    }
  }

  return {
    allowed: true,
    senderId: sellerId,
    viewerId: sellerId,
    useServiceRole: input.canWriteMessages,
  }
}
