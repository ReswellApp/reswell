import Image from "next/image"
import { ArrowLeftRight, ShoppingBag } from "lucide-react"
import reswellWaveAvatar from "@/public/images/reswell-wave-avatar.jpg"

interface ShopifyConsentHeaderProps {
  title: string
  description: string
}

export function ShopifyConsentHeader({ title, description }: ShopifyConsentHeaderProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-3" aria-hidden>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#95BF47] shadow-sm ring-1 ring-black/5">
          <ShoppingBag className="h-7 w-7 text-white" strokeWidth={2.25} />
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-px w-4 border-t border-dashed border-current" />
          <ArrowLeftRight className="h-4 w-4" />
          <span className="h-px w-4 border-t border-dashed border-current" />
        </div>
        <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-black/5">
          <Image src={reswellWaveAvatar} alt="" fill sizes="56px" className="object-cover" />
        </div>
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
