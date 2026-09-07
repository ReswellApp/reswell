import { notFound, redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderSupportRequestById } from "@/lib/db/order-support"
import { getSupportCaseThreadForStaff } from "@/lib/services/supportCaseThread"
import { AdminSupportCaseDesk } from "@/components/features/admin/admin-support-case-desk"
import { adminSupportCaseHref } from "@/lib/utils/support-case-paths"
import { formatSupportCaseReference } from "@/lib/utils/support-case-display"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return privatePageMetadata({
    title: `Support case ${formatSupportCaseReference(id)} — Admin — Reswell`,
    description: "Reply to a customer Help case thread.",
    path: adminSupportCaseHref(id),
  })
}

export default async function AdminSupportCasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/auth/login?redirect=${encodeURIComponent(adminSupportCaseHref(id))}`)

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    redirect("/admin")
  }

  const result = await getSupportCaseThreadForStaff(id)
  if ("error" in result) notFound()

  const row = result.case
  let sidecar = row.order_support_request_id
    ? await getOrderSupportRequestById(supabase, row.order_support_request_id)
    : null
  if (!sidecar && row.order_id) {
    sidecar = await getOrderSupportRequestById(supabase, id)
  }

  let money: {
    status: string
    amount: number
    shippingAmount: number
    paymentMethod: string
  } | null = null
  if (row.order_id) {
    const service = createServiceRoleClient()
    const { data } = await service
      .from("orders")
      .select("status, amount, shipping_amount, payment_method")
      .eq("id", row.order_id)
      .maybeSingle()
    if (data) {
      money = {
        status: String(data.status ?? ""),
        amount: Number(data.amount ?? 0),
        shippingAmount: Number(data.shipping_amount ?? 0),
        paymentMethod: String(data.payment_method ?? "wallet"),
      }
    }
  }

  return (
    <AdminSupportCaseDesk
      caseId={row.id}
      subject={row.subject}
      kind={row.kind}
      customerUserId={row.requester_user_id}
      customerLabel={row.requester_email ?? `${row.requester_role} ${row.requester_user_id?.slice(0, 8) ?? ""}`}
      orderId={row.order_id}
      orderRef={row.order_ref}
      preview={row.preview}
      initialStatus={row.status}
      assigneeAdminId={row.assignee_admin_id}
      messages={result.messages}
      closed={row.status === "resolved"}
      refund={
        money && row.order_id && row.order_ref
          ? {
              orderStatus: money.status,
              amount: money.amount,
              shippingAmount: money.shippingAmount,
              paymentMethod: money.paymentMethod,
              repairCreditTotal: sidecar?.repair_credit_total ?? 0,
            }
          : null
      }
      claimDesk={
        sidecar && sidecar.request_type === "refund_help"
          ? {
              orderSupportRequestId: sidecar.id,
              orderId: sidecar.order_id,
              initialCarrierClaimStatus: sidecar.carrier_claim_status,
              initialCarrierClaimId: sidecar.carrier_claim_id,
              initialCarrierClaimUrl: sidecar.carrier_claim_url,
              initialInsuranceClaimUrl: sidecar.insurance_claim_url,
              initialRepairCreditTotal: sidecar.repair_credit_total,
            }
          : null
      }
    />
  )
}
