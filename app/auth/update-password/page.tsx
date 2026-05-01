"use client"

import { UpdatePasswordFormPanel } from "@/components/auth/update-password-form-panel"

/** Full-page fallback; successful email links redirect to `/` + dialog via `/auth/recovery`. */
export default function Page() {
  return <UpdatePasswordFormPanel />
}
