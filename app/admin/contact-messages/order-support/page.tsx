import { redirect } from "next/navigation"

/** Legacy path — order cases are filtered in the unified Case inbox. */
export default function LegacyContactMessagesOrderSupportRedirect() {
  redirect("/admin/contact-messages?type=order")
}
