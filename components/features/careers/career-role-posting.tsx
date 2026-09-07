import Link from "next/link"
import { CareerRoleApplyCard } from "@/components/features/careers/career-role-apply-card"
import { CareerRolePhotoGrid } from "@/components/features/careers/career-role-photo-grid"
import { careerRoleTypeLabel, type CareerRole } from "@/lib/careers"

type CareerRolePostingProps = {
  role: CareerRole
}

function sectionByHeading(role: CareerRole, heading: string) {
  return role.sections.find((section) => section.heading === heading)
}

export function CareerRolePosting({ role }: CareerRolePostingProps) {
  const intro = sectionByHeading(role, "The role")
  const work = sectionByHeading(role, "What you'll do")
  const lookingFor = sectionByHeading(role, "What we're looking for")
  const niceToHave = sectionByHeading(role, "Nice to have")
  const offer = sectionByHeading(role, "What we offer")

  const facts = [
    { label: "Location", value: role.location },
    { label: "Type", value: careerRoleTypeLabel(role) },
    { label: "Department", value: role.department },
    { label: "Reports to", value: role.reportsTo },
  ] as const

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start lg:gap-12">
      <article>
        <p className="text-lg leading-relaxed text-foreground">{role.about}</p>
        {intro?.body ? (
          <p className="mt-5 text-base leading-relaxed text-foreground/90">{intro.body}</p>
        ) : null}

        {role.photos && role.photos.length > 0 ? (
          <CareerRolePhotoGrid className="mt-12" photos={role.photos.slice(0, 1)} />
        ) : null}

        <dl className="mt-12 grid gap-4 border-y border-border/80 py-6 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {fact.label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {work?.items ? (
          <section className="pt-10">
            <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
              What you&apos;ll do
            </h2>
            <ol className="mt-6 space-y-5">
              {work.items.map((item, index) => (
                <li key={item} className="flex gap-4">
                  <span className="w-8 shrink-0 font-headline text-sm font-semibold tabular-nums text-listingHeart">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-base leading-relaxed text-foreground">{item}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {role.photos && role.photos.length > 1 ? (
          <CareerRolePhotoGrid className="mt-12" photos={role.photos.slice(1)} />
        ) : null}

        {lookingFor?.items || niceToHave?.items ? (
          <section className="grid gap-10 border-t border-border/80 pt-10 sm:grid-cols-2">
            {lookingFor?.items ? (
              <div>
                <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
                  You
                </h2>
                <ul className="mt-5 space-y-3">
                  {lookingFor.items.map((item) => (
                    <li key={item} className="text-base leading-relaxed text-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {niceToHave?.items ? (
              <div>
                <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
                  Nice to have
                </h2>
                <ul className="mt-5 space-y-3">
                  {niceToHave.items.map((item) => (
                    <li key={item} className="text-base leading-relaxed text-foreground/90">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {offer?.items ? (
          <section className="border-t border-border/80 pt-10">
            <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
              What we offer
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {offer.items.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-10 lg:hidden">
          <CareerRoleApplyCard role={role} />
        </div>

        <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
          Reswell is an equal opportunity employer.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/careers" className="font-medium text-foreground underline underline-offset-4">
            All open roles
          </Link>
        </p>
      </article>

      <aside className="sticky top-24 hidden lg:block">
        <CareerRoleApplyCard role={role} />
      </aside>
    </div>
  )
}
