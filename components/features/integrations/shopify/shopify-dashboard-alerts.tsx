import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ShopifyDashboardAlertsProps {
  connected: boolean
  runtimeReady: boolean
  configured: boolean
  error: string | null
}

export function ShopifyDashboardAlerts({
  connected,
  runtimeReady,
  configured,
  error,
}: ShopifyDashboardAlertsProps) {
  return (
    <>
      {connected ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Shopify connected</AlertTitle>
          <AlertDescription>
            Open Add products to choose what you publish on Reswell.
          </AlertDescription>
        </Alert>
      ) : null}
      {!runtimeReady ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Shopify access approved</AlertTitle>
          <AlertDescription>
            {configured
              ? "The integration is temporarily paused. Your Shopify access is still approved."
              : "Reswell is finishing the Shopify app setup. This page will become active when configuration is complete."}
          </AlertDescription>
        </Alert>
      ) : null}
      {runtimeReady && error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Shopify needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}
