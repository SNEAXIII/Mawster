'use client'

import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import { Button } from '@/components/ui/button'
import { ActionIconButton } from '@/components/action-icon-button'
import { Section, Variant } from '../_components/showcase-section'

const VARIANTS = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const
const SIZES = ['sm', 'default', 'lg'] as const
const ACTION_VARIANTS = ['default', 'info', 'success', 'danger'] as const
const noop = () => {}

export default function ButtonsShowcase() {
  return (
    <>
      {SIZES.map((size) => (
        <Section
          key={size}
          title={`Button — size ${size}`}
        >
          {VARIANTS.map((variant) => (
            <Variant
              key={variant}
              label={variant}
            >
              <Button
                variant={variant}
                size={size}
              >
                <FiPlus /> Add
              </Button>
            </Variant>
          ))}
        </Section>
      ))}

      <Section title='Button — states'>
        <Variant label='disabled'>
          <Button disabled>Disabled</Button>
        </Variant>
        <Variant label='icon'>
          <Button
            size='icon'
            variant='outline'
          >
            <FiEdit2 />
          </Button>
        </Variant>
      </Section>

      <Section title='ActionIconButton'>
        {ACTION_VARIANTS.map((variant) => (
          <Variant
            key={variant}
            label={variant}
          >
            <ActionIconButton
              icon={<FiTrash2 />}
              onClick={noop}
              variant={variant}
            />
          </Variant>
        ))}
      </Section>
    </>
  )
}
