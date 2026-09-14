"use client"

import { useState } from "react"

import { SellShipFromAddressDialog } from "@/components/features/sell/sell-ship-from-address-dialog"

export function SellMissingShipFromPrompt({
  needsFullName,
  needsPhone,
}: {
  needsFullName: boolean
  needsPhone: boolean
}) {
  const [open, setOpen] = useState(true)

  return (
    <SellShipFromAddressDialog
      open={open}
      needsFullName={needsFullName}
      needsPhone={needsPhone}
      allowDismissToPickup={false}
      title="Add your ship-from address"
      description="You have sold boards or fins on Reswell. Save the address we should print on shipping labels after a sale. Buyers see your city — never your street address."
      onSaved={() => setOpen(false)}
    />
  )
}
