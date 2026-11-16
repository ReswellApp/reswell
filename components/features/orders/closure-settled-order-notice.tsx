import Link from "next/link"

export function ClosureSettledOrderNotice({ kind }: { kind: "sale" | "purchase" }) {
  const sale = kind === "sale"
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        This {sale ? "sale" : "purchase"} is complete
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {sale
          ? "Delivery is finished and earnings are released. Transfer anything still in your balance from Earnings."
          : "This order has been delivered. Purchases stay on your list only while they are still on the way, or while a return or refund is open."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={sale ? "/dashboard/sales" : "/dashboard/purchases"}
          className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
        >
          {sale ? "Back to sales" : "Back to purchases"}
        </Link>
        {sale ? (
          <Link
            href="/dashboard/earnings"
            className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground"
          >
            Earnings
          </Link>
        ) : null}
      </div>
    </div>
  )
}
