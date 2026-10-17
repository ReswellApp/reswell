import Link from "next/link"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SearchResultsFilterButtonProps {
  href: string
}

/** Opens section browse filters for the current marketplace search. */
export function SearchResultsFilterButton({ href }: SearchResultsFilterButtonProps) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-10 shrink-0 gap-2 rounded-full border-[#001A4A]/15 bg-white px-4 text-sm font-medium text-[#001A4A] shadow-none hover:bg-[#F9F9F2]"
    >
      <Link href={href}>
        <SlidersHorizontal className="h-4 w-4 stroke-[1.75]" aria-hidden="true" />
        Filter
      </Link>
    </Button>
  )
}
