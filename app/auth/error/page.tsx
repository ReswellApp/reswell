import { redirect } from "next/navigation"
import { buildAuthCompletingPath } from "@/lib/auth/build-auth-completing-url"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

export default async function Page(props: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const params = await props.searchParams
  redirect(buildAuthCompletingPath(safeRedirectPath(params?.redirect ?? null)))
}
