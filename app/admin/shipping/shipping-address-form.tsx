'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AddressFields } from './address-fields'
import { AddressLine1Suggest } from './address-autofill-search'

export function AddressForm({
  value,
  onChange,
  inputClassName,
  selectTriggerClassName,
  formId,
}: {
  value: AddressFields
  onChange: (v: AddressFields) => void
  inputClassName: string
  selectTriggerClassName: string
  formId: string
}) {
  const patch = (partial: Partial<AddressFields>) => onChange({ ...value, ...partial })
  const lab = 'text-[12px] font-medium text-muted-foreground'
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label className={lab}>Name</Label>
        <Input
          value={value.name}
          className={inputClassName}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={lab}>Phone</Label>
        <Input
          value={value.phone}
          className={inputClassName}
          onChange={(e) => patch({ phone: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={lab}>Residential</Label>
        <Select
          value={value.residential}
          onValueChange={(v) => patch({ residential: v as AddressFields['residential'] })}
        >
          <SelectTrigger className={selectTriggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <AddressLine1Suggest
        value={value.address_line1}
        onChange={(line1) => patch({ address_line1: line1 })}
        onApplyPatch={patch}
        inputClassName={inputClassName}
        inputId={`${formId}-address-line-1`}
      />
      <div className="space-y-1.5 sm:col-span-2">
        <Label className={lab}>Address line 2</Label>
        <Input
          value={value.address_line2}
          className={inputClassName}
          onChange={(e) => patch({ address_line2: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={lab}>City</Label>
        <Input
          value={value.city_locality}
          className={inputClassName}
          onChange={(e) => patch({ city_locality: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={lab}>State / province</Label>
        <Input
          value={value.state_province}
          className={inputClassName}
          onChange={(e) => patch({ state_province: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={lab}>Postal code</Label>
        <Input
          value={value.postal_code}
          className={inputClassName}
          onChange={(e) => patch({ postal_code: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={lab}>Country</Label>
        <Input
          value={value.country_code}
          className={inputClassName}
          onChange={(e) => patch({ country_code: e.target.value })}
        />
      </div>
    </div>
  )
}
