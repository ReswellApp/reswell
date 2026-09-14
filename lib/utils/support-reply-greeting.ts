type GreetingRole = "buyer" | "seller" | "member" | "guest"

function usablePersonName(value: string | null | undefined): string | null {
  const name = value?.replace(/\s+/g, " ").trim() ?? ""
  if (!name || name.includes("@")) return null
  return name
}

/** Inbox-style greeting: contact/profile name, never an email. */
export function supportReplyGreetingName(input: {
  contactName?: string | null
  displayName?: string | null
  role: GreetingRole
}): string {
  const name = usablePersonName(input.contactName) ?? usablePersonName(input.displayName)
  if (name) return name
  if (input.role === "seller") return "Seller"
  if (input.role === "buyer") return "Buyer"
  return "Member"
}
