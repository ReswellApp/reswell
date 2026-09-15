export type CsAgentCitationOrder = {
  id: string
  orderNum: string | null
}

export type CsAgentCitationTicket = {
  id: string
  subject: string
}

/** Map model citations onto in-scope orders the harness actually resolved (linked or tool lookup). */
export function citationsFromAgent(args: {
  orders: Array<CsAgentCitationOrder | null | undefined>
  orderRefs: string[]
  tickets: CsAgentCitationTicket[]
  ticketIds: string[]
}): {
  orders: Array<{ id: string; orderRef: string }>
  tickets: Array<{ id: string; subject: string; href: string }>
} {
  const knownOrders = args.orders.filter((order): order is CsAgentCitationOrder => Boolean(order))
  const seenOrders = new Set<string>()
  const orders = args.orderRefs.flatMap((ref) => {
    const needle = ref.trim().toLowerCase()
    if (!needle) return []
    const match = knownOrders.find(
      (order) =>
        order.id.toLowerCase() === needle ||
        (order.orderNum?.trim().toLowerCase() ?? "") === needle,
    )
    if (!match || seenOrders.has(match.id)) return []
    seenOrders.add(match.id)
    return [{ id: match.id, orderRef: match.orderNum ?? match.id.slice(0, 8) }]
  })
  const tickets = args.ticketIds.flatMap((id) => {
    const ticket = args.tickets.find((row) => row.id === id)
    if (!ticket) return []
    return [
      {
        id: ticket.id,
        subject: ticket.subject,
        href: `/admin/contact-messages?case=${encodeURIComponent(`sc:${ticket.id}`)}`,
      },
    ]
  })
  return { orders, tickets }
}
