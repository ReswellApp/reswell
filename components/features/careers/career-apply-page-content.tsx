import Link from "next/link"
import { CareerApplyPanel } from "@/components/features/careers/career-apply-panel"
import {
  CAREER_GENERAL_APPLY_NOTE,
  CAREER_GENERAL_FAVORITE_BOARD_PROMPT,
  CAREER_GENERAL_SURFING_PROMPT,
  careerRoleHref,
  careerRoleTypeLabel,
  type CareerRole,
} from "@/lib/careers"

type CareerApplyPageContentProps = {
  role?: CareerRole
}

export function CareerApplyPageContent({ role }: CareerApplyPageContentProps) {
  const surfingLabel = role?.applyItems[0] ?? CAREER_GENERAL_SURFING_PROMPT
  const favoriteBoardLabel = role?.applyItems[1] ?? CAREER_GENERAL_FAVORITE_BOARD_PROMPT
  const note = role?.applyNote ?? CAREER_GENERAL_APPLY_NOTE
  const backHref = role ? careerRoleHref(role) : "/careers"
  const backLabel = role ? role.title : "All open roles"

  return (
    <main className="flex-1 bg-background">
      <section className="border-b border-border/70">
        <div className="container mx-auto max-w-xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/careers" className="hover:text-foreground">
              Careers
            </Link>
            {role ? (
              <>
                <span aria-hidden> / </span>
                <Link href={careerRoleHref(role)} className="hover:text-foreground">
                  {role.department}
                </Link>
              </>
            ) : null}
          </p>
          <h1 className="mt-3 font-headline text-[clamp(1.6rem,4vw,2.25rem)] font-bold leading-[1.15] tracking-tight text-foreground">
            {role ? role.title : "General application"}
          </h1>
          {role ? (
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {role.location}
              {" · "}
              {careerRoleTypeLabel(role)}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              No listed role in mind — tell us about yourself anyway.
            </p>
          )}
        </div>
      </section>

      <section className="container mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10">
        <CareerApplyPanel
          roleSlug={role?.slug}
          roleTitle={role?.title ?? "General application"}
          intro={role?.applyIntro ?? "A couple of questions. We read every one."}
          surfingLabel={surfingLabel}
          favoriteBoardLabel={favoriteBoardLabel}
          note={note}
        />
        <p className="mt-6 text-sm">
          <Link href={backHref} className="font-medium text-foreground underline underline-offset-4">
            Back to {backLabel}
          </Link>
        </p>
        <p className="mt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs leading-relaxed text-muted-foreground">
          Reswell is an equal opportunity employer.
        </p>
      </section>
    </main>
  )
}
