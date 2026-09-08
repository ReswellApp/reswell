import Link from "next/link"
import { Check, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"

function firstNameFrom(name: string): string | null {
  const first = name.trim().split(/\s+/)[0]
  return first && first.length >= 2 ? first : null
}

export function CareerApplicationReceived({
  applicantName,
  roleTitle,
}: {
  applicantName: string
  roleTitle: string
}) {
  const first = firstNameFrom(applicantName)
  const heading = first ? `You’re in, ${first}.` : "You’re in."

  return (
    <div className="text-center">
      <div className="relative mx-auto flex h-[4.25rem] w-[4.25rem] items-center justify-center">
        <span
          className="absolute inset-0 rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/[0.06]"
          aria-hidden
        />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
          <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </span>
      </div>

      <p className="mt-5 font-headline text-[1.65rem] font-bold leading-tight tracking-tight text-foreground">
        {heading}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        Your application for{" "}
        <span className="font-medium text-foreground">{roleTitle}</span> is on our desk.
      </p>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        We’ll read it like we’d look at a good board — slowly, and for real. If it’s a fit,
        you’ll hear by email.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button className="min-h-11 rounded-xl font-semibold" asChild>
          <Link href="/boards">Browse boards</Link>
        </Button>
        <Button className="min-h-11 rounded-xl font-semibold" variant="outline" asChild>
          <Link href="/careers">See other roles</Link>
        </Button>
      </div>

      <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Waves className="h-3.5 w-3.5" aria-hidden />
        No need to follow up — we’ve got it.
      </p>
    </div>
  )
}
