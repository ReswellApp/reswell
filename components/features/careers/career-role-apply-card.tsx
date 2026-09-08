import Link from "next/link"
import { Button } from "@/components/ui/button"
import { careerRoleApplyHref, type CareerRole } from "@/lib/careers"

type CareerRoleApplyCardProps = {
  role: CareerRole
}

export function CareerRoleApplyCard({ role }: CareerRoleApplyCardProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <p className="font-headline text-base font-semibold text-foreground">How to apply</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.applyIntro}</p>
      <Button className="mt-5 min-h-11 w-full" asChild>
        <Link href={careerRoleApplyHref(role)}>Start application</Link>
      </Button>
    </div>
  )
}
