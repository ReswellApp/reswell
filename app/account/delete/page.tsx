import Link from "next/link"
import { redirect } from "next/navigation"
import { ACCOUNT_DELETE_PATH } from "@/lib/account-deletion"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { DeleteAccountForm } from "@/components/features/account/delete-account-form"
import { getAccountDeletionEligibility } from "@/lib/services/accountDeletion"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Delete account — Reswell",
  description: "Permanently delete your Reswell account and personal profile data.",
  path: ACCOUNT_DELETE_PATH,
})

export default async function DeleteAccountPage() {
  const { user } = await getCachedRequestSession()
  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(ACCOUNT_DELETE_PATH)}`)
  }

  const eligibility = await getAccountDeletionEligibility(user.id)
  const blockers = eligibility.ok ? eligibility.blockers : []
  const eligibilityError = eligibility.ok ? null : eligibility.error

  return (
    <main className="flex-1 py-12">
      <div className="container mx-auto max-w-xl space-y-8">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Account
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Delete account</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Permanently delete your Reswell account and the personal data we don&apos;t need to keep
            for completed orders, payouts, or legal records.
          </p>
        </div>

        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>You will be signed out and won&apos;t be able to sign in again.</li>
          <li>Active listings are taken down. Your public profile is anonymized.</li>
          <li>Saved addresses, favorites, follows, and saved searches are removed.</li>
          <li>
            Finish open purchases and sales, and cash out remaining earnings, before deleting.
          </li>
          <li>Transaction records may stay with a deleted display name where the law requires it.</li>
        </ul>

        {eligibilityError ? (
          <p className="text-sm text-destructive">{eligibilityError}</p>
        ) : (
          <DeleteAccountForm email={user.email ?? null} blockers={blockers} />
        )}

        <p className="text-sm text-muted-foreground">
          Changed your mind?{" "}
          <Link href="/dashboard/profile#sign-in" className="text-foreground underline underline-offset-2">
            Back to profile
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
