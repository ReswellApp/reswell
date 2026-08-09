import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"

type SellListingPhotoEmptyDropzoneProps = {
  fileInputId: string
  onFilesSelected: (files: FileList) => void
  /** Shown under the main CTA line. */
  hint?: string
  className?: string
}

/** Full-width empty photo upload surface for /sell start sections. */
export function SellListingPhotoEmptyDropzone({
  fileInputId,
  onFilesSelected,
  hint = "Drag and drop or click to browse. The first photo becomes your cover image.",
  className,
}: SellListingPhotoEmptyDropzoneProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[15rem] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-400/80 bg-slate-50/80 px-5 py-12 text-center transition-colors sm:min-h-[16rem] sm:px-6 sm:py-10",
        "hover:border-primary/50 hover:bg-primary/[0.03]",
        className,
      )}
    >
      <label
        htmlFor={fileInputId}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label="Add listing photos"
      />
      <div className="pointer-events-none flex flex-col items-center gap-3.5" aria-hidden>
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-slate-900/5">
          <Upload className="h-7 w-7 text-foreground/70" strokeWidth={1.75} />
        </span>
        <div className="space-y-1.5">
          <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Add photos of your item
          </p>
          <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">{hint}</p>
        </div>
      </div>
      <input
        id={fileInputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected(e.target.files)
          e.target.value = ""
        }}
      />
    </div>
  )
}
