/** Short staff welcome after a case is linked. */
export function formatSupportCaseWelcomeMessage(args: {
  topicLabel: string
  caseRef: string
}): string {
  return [
    `Thanks for reaching out — we’ve opened your case (${args.caseRef}).`,
    "",
    `Topic: ${args.topicLabel}`,
    "",
    "Reply here anytime. We’ll update you in this chat and by email.",
  ].join("\n")
}

/** Legacy marketplace-DM opening copied into support tickets before cases were canonical. */
export function formatSupportTicketOpeningMessage(args: {
  ticketId: string
  topicLabel: string
  body: string
}): string {
  return [
    "Reswell support ticket",
    "",
    `Topic: ${args.topicLabel}`,
    "",
    "—",
    "",
    args.body.trim(),
    "",
    "—",
    "",
    `Ticket ID: ${args.ticketId}`,
    "You’ll get updates in this chat as our team moves it forward.",
  ].join("\n")
}
