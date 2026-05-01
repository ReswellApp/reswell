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
  const supportThreadLine =
    msg.support_conversation_id != null && msg.support_conversation_id.trim() !== ""
      ? `- **Support DM:** \`${msg.support_conversation_id}\` (reply in /messages)`
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
    ...(supportThreadLine ? [supportThreadLine] : []),
    "",
    "### Message",
    "",
    msg.message.trim(),
    "",
    "---",
    "_Use **Open in Messages** in admin when a support thread is linked._",
  ].join("\n")
}
