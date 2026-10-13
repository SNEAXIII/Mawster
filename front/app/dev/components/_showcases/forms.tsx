'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchInput } from '@/components/search-input'
import { CLASS_ORDER } from '@/app/lib/champion-class'
import { Section, Variant } from '../_components/showcase-section'

export default function FormsShowcase() {
  const [search, setSearch] = useState('Thanos')

  return (
    <>
      <Section title='Inputs'>
        <Variant label='empty'>
          <Input
            className='w-48'
            placeholder='Pseudo in game'
          />
        </Variant>
        <Variant label='filled'>
          <Input
            className='w-48'
            defaultValue='Sneaxiii'
          />
        </Variant>
        <Variant label='disabled'>
          <Input
            className='w-48'
            defaultValue='Locked'
            disabled
          />
        </Variant>
        <Variant label='SearchInput'>
          <SearchInput
            className='w-56'
            value={search}
            onChange={setSearch}
          />
        </Variant>
      </Section>

      <Section title='Select (portal)'>
        <Select defaultValue='Cosmic'>
          <SelectTrigger className='w-44'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLASS_ORDER.map((c) => (
              <SelectItem
                key={c}
                value={c}
              >
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section title='Checkbox / Switch'>
        {[true, false].map((checked) => (
          <Variant
            key={String(checked)}
            label={checked ? 'checked' : 'unchecked'}
          >
            <div className='flex items-center gap-4'>
              <Checkbox defaultChecked={checked} />
              <Switch defaultChecked={checked} />
            </div>
          </Variant>
        ))}
        <Variant label='with label'>
          <div className='flex items-center gap-2'>
            <Switch
              id='showcase-switch'
              defaultChecked
            />
            <Label htmlFor='showcase-switch'>Preferred attackers only</Label>
          </div>
        </Variant>
      </Section>

      <Section title='ToggleGroup (shadcn)'>
        <ToggleGroup
          type='single'
          defaultValue='7'
        >
          {['5', '6', '7'].map((star) => (
            <ToggleGroupItem
              key={star}
              value={star}
            >
              {star}★
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Section>
    </>
  )
}
