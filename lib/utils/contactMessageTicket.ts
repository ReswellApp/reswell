import type { ContactMessageRow } from "@/lib/db/contactMessages"

export function buildContactTicketDraft(msg: ContactMessageRow): string {
  const created = new Date(msg.created_at).toISOString()
  return [
    "## Contact — Reswell",
    "",
    `- **Message ID:** \`${msg.id}\``,
    `- **Received:** ${created}`,
    `- **Customer:** ${msg.name}`,
    `- **Email:** ${msg.email}`,
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
