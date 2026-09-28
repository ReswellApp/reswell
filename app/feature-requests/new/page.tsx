import Link from "next/link"
import { createFeatureRequestAction } from "@/lib/actions/featureRequests"
import { FeatureRequestShell } from "@/components/features/feature-requests/feature-request-shell"
import { FEATURE_REQUEST_TAGS } from "@/lib/types/feature-requests"
import { FEATURE_REQUEST_TAG_LABEL, FEATURE_REQUESTS_PATH } from "@/lib/utils/feature-requests"

export const metadata = {
  title: "Post an idea — Reswell",
  robots: { index: false, follow: false },
}

export default async function NewFeatureRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const error = typeof raw.error === "string" ? raw.error : null

  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <FeatureRequestShell active="detail" />
        <h1 className="mt-8 font-headline text-3xl font-bold tracking-tight text-neutral-950">Post an idea</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Share a feature or a bug. Other members can vote and comment, and Reswell uses the board to decide what to build next.
        </p>
        <form action={createFeatureRequestAction} className="mt-6 space-y-4">
          <fieldset className="flex flex-wrap gap-4">
            <legend className="sr-only">Type</legend>
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input type="radio" name="kind" value="feature" defaultChecked />
              Feature idea
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input type="radio" name="kind" value="bug" />
              Bug
            </label>
          </fieldset>
          <input
            name="title"
            required
            minLength={4}
            maxLength={140}
            placeholder="What should we build?"
            aria-label="Title"
            className="h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm"
          />
          <textarea
            name="body"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            placeholder="Add the details other members need in order to vote."
            aria-label="Description"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <fieldset>
            <legend className="text-xs font-medium text-neutral-500">Tags</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FEATURE_REQUEST_TAGS.map((tag) => (
                <label key={tag} className="flex cursor-pointer items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">
                  <input type="checkbox" name="tags" value={tag} />
                  {FEATURE_REQUEST_TAG_LABEL[tag]}
                </label>
              ))}
            </div>
          </fieldset>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="h-10 rounded-full bg-[#3B6CF6] px-4 text-sm font-medium text-white hover:bg-[#2F5FE0]"
            >
              Post idea
            </button>
            <Link href={FEATURE_REQUESTS_PATH} className="text-sm text-neutral-500 hover:text-neutral-800">
              Cancel
            </Link>
          </div>
          <p className="text-xs text-neutral-500">
            <Link href={`/auth/login?redirect=${encodeURIComponent("/feature-requests/new")}`} className="underline">
              Sign in
            </Link>{" "}
            to post. Signed-out submissions send you to sign in first.
          </p>
        </form>
      </div>
    </main>
  )
}
