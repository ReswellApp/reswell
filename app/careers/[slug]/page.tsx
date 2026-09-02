import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CareerRolePosting } from "@/components/features/careers/career-role-posting"
import { careerRoleHref, careerRoles, getCareerRoleBySlug } from "@/lib/careers"
import { wideShimmer } from "@/lib/image-shimmer"
import { pageSeoMetadata } from "@/lib/site-metadata"
import careersHeadlineAtmosphere from "@/public/images/careers/headline-barrel.jpg"

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return careerRoles.map((role) => ({ slug: role.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const role = getCareerRoleBySlug(slug)
  if (!role) return {}
  return pageSeoMetadata({
    title: `${role.title} | Careers at Reswell`,
    description: role.summary,
    path: careerRoleHref(role),
  })
}

export default async function CareerRolePage({ params }: PageProps) {
  const { slug } = await params
  const role = getCareerRoleBySlug(slug)
  if (!role) notFound()

  return (
    <main className="flex-1">
      <section className="relative isolate h-[min(38vh,22rem)] min-h-[12rem] w-full overflow-hidden">
        <Image
          src={careersHeadlineAtmosphere}
          alt=""
          fill
          priority
          quality={95}
          sizes="100vw"
          className="object-cover object-center"
          placeholder="blur"
          blurDataURL={wideShimmer}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-black/40" aria-hidden />
        <div className="relative z-10 flex h-full flex-col justify-end px-4 pb-8 sm:px-6 sm:pb-10">
          <div className="container mx-auto max-w-5xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/75">
              <Link href="/careers" className="hover:text-white">
                Careers
              </Link>
              <span aria-hidden> / </span>
              {role.department}
            </p>
            <h1 className="mt-3 max-w-3xl font-headline text-[clamp(1.6rem,3.5vw,2.5rem)] font-bold leading-[1.1] tracking-tight text-white">
              {role.title}
            </h1>
            <p className="mt-2 text-sm text-white/85 sm:text-base">{role.summary}</p>
          </div>
        </div>
      </section>
      <section className="container mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <CareerRolePosting role={role} />
      </section>
    </main>
  )
}
