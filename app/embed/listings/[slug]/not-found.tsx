export default function PartnerListingEmbedNotFound() {
  return (
    <div className="mx-auto w-full max-w-[920px] px-3 py-4">
      <div className="rounded-sm border border-neutral-300 bg-[#fafafa] px-4 py-6 text-center">
        <p className="text-sm font-semibold text-neutral-900">This listing feed is unavailable.</p>
        <p className="mt-1 text-xs text-neutral-600">
          It may be inactive or still being set up in Reswell admin.
        </p>
      </div>
    </div>
  )
}
