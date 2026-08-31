import Modal from './modal'
import AttributeBadges from './attribute-badges'
import { ATTRIBUTE_LIST } from '@/lib/icons'
import { cn } from '@/lib/cn'
import type { BoardActions } from '@/lib/use-board'
import type { AttributeKey } from '@/lib/types'
import type { Dictionary } from '@/i18n/locales'

interface IconMockupProps {
  open: boolean
  onClose: () => void
  iconChoices: Partial<Record<AttributeKey, string>>
  actions: BoardActions
  t: Dictionary
}

/**
 * Side-by-side comparison of every candidate icon per attribute, with a live
 * badge preview underneath. This is the mockup used to settle on a final icon
 * set before the custom artwork lands — swapping in a real asset later is a new
 * entry in `ATTRIBUTES[key].variants`, nothing else.
 */
export default function IconMockup({
  open,
  onClose,
  iconChoices,
  actions,
  t,
}: Readonly<IconMockupProps>) {
  const previewAttributes = {
    flags: Object.fromEntries(ATTRIBUTE_LIST.map((d) => [d.key, true])) as Partial<
      Record<AttributeKey, boolean>
    >,
    sig: 200,
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t.close}
      title={t.iconMockup}
      className='sm:max-w-2xl'
    >
      <div className='flex flex-col gap-5'>
        <p className='text-xs text-muted-foreground'>{t.iconMockupHint}</p>

        <div className='rounded-lg border border-border bg-elevated p-3'>
          <AttributeBadges
            attributes={previewAttributes}
            iconChoices={iconChoices}
            size={22}
          />
        </div>

        {ATTRIBUTE_LIST.map((def) => {
          const selected = iconChoices[def.key] ?? def.variants[0].id
          return (
            <section
              key={def.key}
              className='flex flex-col gap-2'
            >
              <h3 className='text-xs font-bold uppercase tracking-wide text-muted-foreground'>
                {def.code}
                {def.hasValue && <span className='ml-2 font-normal normal-case'>(+ x200)</span>}
              </h3>
              <div className='flex flex-wrap gap-2'>
                {def.variants.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type='button'
                    onClick={() => actions.setIconChoice(def.key, id)}
                    aria-pressed={selected === id}
                    className={cn(
                      'flex w-24 flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors',
                      selected === id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-muted-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full ring-1',
                        def.chip
                      )}
                    >
                      <Icon className='h-5 w-5' />
                    </span>
                    <span className='text-[10px] leading-tight text-muted-foreground'>{label}</span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
