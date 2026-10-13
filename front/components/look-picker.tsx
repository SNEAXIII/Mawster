'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { applyLook, PLAYER_LOOKS, readLook, type Look } from '@/app/lib/look'

export default function LookPicker() {
  const [look, setLook] = useState<Look | null>(null)

  // The stored look is only readable once mounted.
  useEffect(() => setLook(readLook()), [])

  if (!look) return null

  return (
    <Select
      value={look}
      onValueChange={(value: Look) => {
        applyLook(value)
        setLook(value)
      }}
    >
      <SelectTrigger
        className='h-8 w-40'
        data-cy='look-picker'
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PLAYER_LOOKS.map(({ value, label }) => (
          <SelectItem
            key={value}
            value={value}
          >
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
