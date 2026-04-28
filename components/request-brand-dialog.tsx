"use client"

/**
 * Sell / brand inputs: “request a brand” — uses the combined catalog dialog with model fields empty.
 * Prefer `RequestBrandModelDialog` when you also have a model name to prefill.
 */
import {
  RequestBrandModelDialog,
  type RequestBrandModelDialogProps,
} from "@/components/request-brand-model-dialog"

export type RequestBrandDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  onSubmitted?: (brandName: string) => void
}

export function RequestBrandDialog({ open, onOpenChange, defaultName, onSubmitted }: RequestBrandDialogProps) {
  const props: RequestBrandModelDialogProps = {
    open,
    onOpenChange,
    variant: "full",
    defaultBrandName: defaultName,
    defaultModelName: "",
    onBrandSubmitted: onSubmitted,
  }
  return <RequestBrandModelDialog {...props} />
}
