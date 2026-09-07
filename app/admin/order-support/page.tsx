import { redirect } from 'next/navigation'

/** Legacy URL — order cases are filtered in the unified Case inbox. */
export default function LegacyAdminOrderSupportRedirect() {
  redirect('/admin/contact-messages?type=order')
}
