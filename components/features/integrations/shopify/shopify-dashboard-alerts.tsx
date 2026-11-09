import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const bannerClass =
  "rounded-xl border border-[#e1e3e5] bg-white py-3 text-[#202223] shadow-none dark:border-border dark:bg-card dark:text-foreground [&>svg]:text-[#6d7175]"

interface ShopifyDashboardAlertsProps {
  runtimeReady: boolean
  configured: boolean
  error: string | null
}

export function ShopifyDashboardAlerts({
  runtimeReady,
  configured,
  error,
}: ShopifyDashboardAlertsProps) {
  return (
    <>
      {!runtimeReady ? (
        <Alert className={bannerClass}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-[13px] font-semibold">Shopify access approved</AlertTitle>
          <AlertDescription className="text-[13px] text-[#6d7175] dark:text-muted-foreground">
            {configured
              ? "The integration is temporarily paused. Your Shopify access is still approved."
              : "Reswell is finishing the Shopify app setup. This page will become active when configuration is complete."}
          </AlertDescription>
        </Alert>
      ) : null}
      {runtimeReady && error ? (
        <Alert
          variant="destructive"
          className={`${bannerClass} border-l-4 border-l-[#d72c0d] text-[#202223] [&>svg]:text-[#d72c0d] dark:text-foreground`}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-[13px] font-semibold">Shopify needs attention</AlertTitle>
          <AlertDescription className="text-[13px] text-[#6d7175] dark:text-muted-foreground">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
