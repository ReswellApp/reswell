import { cookies } from "next/headers"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  LISTING_IMPORT_ACCESS_COOKIE,
  isListingImportAccessKeyValid,
  listingImportAccessKeyConfigured,
  userHasListingImportAccess,
} from "@/lib/import-listing-access"
import ImportListingClient from "./import-listing-client"

export default async function ImportListingPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string | string[] }>
}) {
  const sp = await searchParams
  const queryKey = typeof sp.key === "string" ? sp.key : sp.key?.[0]

  if (isListingImportAccessKeyValid(queryKey)) {
    const cookieStore = await cookies()
    cookieStore.set(LISTING_IMPORT_ACCESS_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const allowed = await userHasListingImportAccess({
    supabase,
    userId: user?.id ?? null,
    queryKey,
    cookieValue: cookieStore.get(LISTING_IMPORT_ACCESS_COOKIE)?.value,
  })

  if (!allowed) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16">
        <h1 className="text-2xl font-semibold text-foreground">Import not available</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This page is invite-only. Open the link you were sent, or ask the Reswell team for access.
        </p>
        {!listingImportAccessKeyConfigured() ? (
          <p className="mt-2 text-xs text-muted-foreground/70">
            Admins can use this page without an invite link.
          </p>
        ) : null}
        <Link href="/" className="mt-6 text-sm font-medium text-primary underline">
          Back to Reswell
        </Link>
      </main>
    )
  }

  return (
    <ImportListingClient
      isSignedIn={Boolean(user)}
      accessKeyInUrl={queryKey ?? null}
    />
  )
}
