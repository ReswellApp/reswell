import { redirect } from "next/navigation"

/** Legacy path; order support is a tab on Support inbox. */
export default function LegacyContactMessagesOrderSupportRedirect() {
  redirect("/admin/contact-messages?tab=order-support")
}
