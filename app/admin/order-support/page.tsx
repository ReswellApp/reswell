import { redirect } from 'next/navigation'

/** Legacy URL; order support lives under Support inbox. */
export default function LegacyAdminOrderSupportRedirect() {
  redirect('/admin/contact-messages?tab=order-support')
}
