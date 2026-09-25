export interface EmailMergeToken {
  label: string
  value: string
  group: "Profile" | "Order" | "Listing" | "Support" | "Footer"
}

/** Klaviyo tags Reswell already uses in flow HTML. `lookup` survives the code editor. */
export const EMAIL_MERGE_TOKENS: EmailMergeToken[] = [
  { group: "Profile", label: "First name", value: "{{ first_name|default:'there' }}" },
  { group: "Profile", label: "Last name", value: "{{ last_name|default:'' }}" },
  { group: "Profile", label: "Email", value: "{{ email }}" },
  { group: "Order", label: "Order number", value: "{{ event|lookup:'order_num' }}" },
  { group: "Order", label: "Order URL", value: "{{ event|lookup:'order_url' }}" },
  { group: "Order", label: "Order value", value: "{{ event|lookup:'$value' }}" },
  { group: "Listing", label: "Title", value: "{{ event|lookup:'Title' }}" },
  { group: "Listing", label: "Listing URL", value: "{{ event|lookup:'listing_url' }}" },
  { group: "Listing", label: "Image URL", value: "{{ event|lookup:'listing_image_url' }}" },
  { group: "Support", label: "Ticket subject", value: "{{ event|lookup:'subject' }}" },
  { group: "Support", label: "Ticket URL", value: "{{ event|lookup:'ticket_url' }}" },
  { group: "Footer", label: "Unsubscribe", value: "{% unsubscribe 'Unsubscribe' %}" },
  { group: "Footer", label: "Postal address", value: "{{ organization.full_address }}" },
]
