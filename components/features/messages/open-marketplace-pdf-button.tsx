"use client"

import type { ComponentProps } from "react"
import { useCallback, useState } from "react"
import { Download, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function OpenMarketplacePdfButton({
  messageId,
  fileName,
  className,
  variant = "outline",
  size = "sm",
}: {
  messageId: string
  fileName: string
  className?: string
  variant?: ComponentProps<typeof Button>["variant"]
  size?: ComponentProps<typeof Button>["size"]
}) {
  const [openBusy, setOpenBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)

  const attachmentPath = `/api/messages/${messageId}/attachment`

  async function prepareAndOpen() {
    setOpenBusy(true)
    try {
      const probe = await fetch(attachmentPath, { method: "HEAD" })
      if (!probe.ok) {
        if (probe.status === 401) {
          toast.error("Sign in required")
        } else {
          toast.error("Could not open PDF")
        }
        return
      }
      setOpen(true)
    } catch {
      toast.error("Could not open PDF")
    } finally {
      setOpenBusy(false)
    }
  }

  const downloadPdf = useCallback(async () => {
    setDownloadBusy(true)
    try {
      const res = await fetch(attachmentPath)
      if (!res.ok) {
        toast.error("Could not download PDF")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      try {
        const safeName = fileName.trim() || "attachment.pdf"
        const a = document.createElement("a")
        a.href = url
        a.download = safeName
        a.rel = "noopener"
        document.body.appendChild(a)
        a.click()
        a.remove()
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch {
      toast.error("Could not download PDF")
    } finally {
      setDownloadBusy(false)
    }
  }, [attachmentPath, fileName])

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-2", className)}
        disabled={openBusy}
        onClick={() => void prepareAndOpen()}
      >
        {openBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <FileText className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="max-w-[12rem] truncate sm:max-w-[16rem]">{fileName}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className={cn(
            "flex max-h-[90vh] w-full max-w-[min(calc(100vw-2rem),56rem)] translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden p-0 sm:max-h-[85vh]",
          )}
        >
          <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-14 text-left">
            <DialogTitle className="truncate text-base font-medium leading-snug">{fileName}</DialogTitle>
            <DialogDescription className="sr-only">
              Preview of the PDF attachment. Use download to save a copy.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-muted/25">
            {open ? (
              <iframe
                title={`PDF: ${fileName}`}
                src={attachmentPath}
                className="h-[min(70vh,640px)] w-full border-0 sm:h-[min(75vh,720px)]"
              />
            ) : null}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:justify-end">
            <Button
              type="button"
              className="w-full gap-2 sm:w-auto"
              disabled={downloadBusy}
              onClick={() => void downloadPdf()}
            >
              {downloadBusy ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4 shrink-0" aria-hidden />
              )}
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
