import type { ContactMessageRow } from "@/lib/db/contactMessages"

export function buildContactTicketDraft(msg: ContactMessageRow): string {
  const created = new Date(msg.created_at).toISOString()
  const channel = msg.source === "messages_support" ? "In-app (Messages)" : "Website contact form"
  const subjectLine = msg.subject?.trim() ? `- **Topic:** ${msg.subject.trim()}` : null
  const userLine =
    msg.user_id != null && msg.user_id.trim() !== "" ? `- **User ID:** \`${msg.user_id}\`` : null
  const threadLine =
    msg.related_conversation_id != null && msg.related_conversation_id.trim() !== ""
      ? `- **Related thread:** \`${msg.related_conversation_id}\``
      : null

  return [
    "## Support — Reswell",
    "",
    `- **Message ID:** \`${msg.id}\``,
    `- **Received:** ${created}`,
    `- **Channel:** ${channel}`,
    ...(subjectLine ? [subjectLine] : []),
    `- **Customer:** ${msg.name}`,
    `- **Email:** ${msg.email}`,
    ...(userLine ? [userLine] : []),
    ...(threadLine ? [threadLine] : []),
    "",
    "### Message",
    "",
    msg.message.trim(),
    "",
    "---",
    "_Paste into your tracker (Linear, Jira, etc.), then link the ticket below in admin._",
  ].join("\n")
}

export function buildContactReplyMailto(msg: ContactMessageRow): string {
  const subject = encodeURIComponent(`Re: Your message to Reswell support`)
  const body = encodeURIComponent(
    [
      `Hi ${msg.name.split(/\s+/)[0] ?? "there"},`,
      "",
      "Thanks for contacting us.",
      "",
      "",
      "",
      "— Reswell Support",
    ].join("\n"),
  )
  return `mailto:${msg.email}?subject=${subject}&body=${body}`
}
