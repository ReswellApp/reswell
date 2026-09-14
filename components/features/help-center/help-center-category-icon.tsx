import {
  Banknote,
  ClipboardList,
  CreditCard,
  Package,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  Tags,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import type { HelpCenterCategoryIconId } from "@/lib/help-center/types"

const ICONS: Record<HelpCenterCategoryIconId, LucideIcon> = {
  "shopping-bag": ShoppingBag,
  "credit-card": CreditCard,
  "package-search": PackageSearch,
  package: Package,
  banknote: Banknote,
  "clipboard-list": ClipboardList,
  tags: Tags,
  "user-round": UserRound,
  wallet: Wallet,
  "shield-check": ShieldCheck,
}

export function HelpCenterCategoryIcon({
  icon,
  className,
}: {
  icon: HelpCenterCategoryIconId
  className?: string
}) {
  const Icon = ICONS[icon] ?? PackageSearch
  return <Icon className={className} strokeWidth={1.75} aria-hidden />
}
