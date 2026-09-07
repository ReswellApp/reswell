import { Button } from "@/components/ui/button"
import { careerRoleApplyMailto, type CareerRole } from "@/lib/careers"

type CareerRoleApplyCardProps = {
  role: CareerRole
}

export function CareerRoleApplyCard({ role }: CareerRoleApplyCardProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <p className="font-headline text-base font-semibold text-foreground">How to apply</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.applyIntro}</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
        {role.applyItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      {role.applyNote ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{role.applyNote}</p>
      ) : null}
      <Button className="mt-5 w-full" asChild>
        <a href={careerRoleApplyMailto(role)}>Email to apply</a>
      </Button>
    </div>
  )
}
