import Link from "next/link"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Account deleted — Reswell",
  description: "Your Reswell account has been deleted.",
  path: "/account/deleted",
})

export default function AccountDeletedPage() {
  return (
    <main className="flex-1 py-16">
      <div className="container mx-auto max-w-xl space-y-5 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Account deleted</h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Your Reswell account and personal profile data have been deleted. You can create a new
          account anytime with a different email.
        </p>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-primary-foreground"
        >
          Back to Reswell
        </Link>
      </div>
    </main>
  )
}
