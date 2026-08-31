import Modal from './modal'
import ToggleChip from './toggle-chip'
import ChampionPortrait from './champion-portrait'
import { ATTRIBUTE_LIST, attributeIcon } from '@/lib/icons'
import { attributesOf } from '@/lib/board'
import { readableTextColor } from '@/lib/color'
import type { BoardActions } from '@/lib/use-board'
import { POOL_ID } from '@/lib/use-board'
import type { BoardState, Champion } from '@/lib/types'
import type { Dictionary } from '@/i18n/locales'

/** Common signature levels, mirroring the presets used by the Mawster roster. */
const SIG_PRESETS = [20, 60, 100, 200]

interface ChampionSheetProps {
  champion: Champion | null
  board: BoardState
  actions: BoardActions
  t: Dictionary
  onClose: () => void
}

/**
 * Tap a champion anywhere to open this: it sets the attributes, the signature
 * level, and moves the champion between tiers — the touch-friendly counterpart
 * of dragging.
 */
export default function ChampionSheet({
  champion,
  board,
  actions,
  t,
  onClose,
}: Readonly<ChampionSheetProps>) {
  if (!champion) return null

  const attrs = attributesOf(board, champion.id)
  const currentTier = board.tiers.find((tier) => tier.championIds.includes(champion.id))

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t.close}
      title={champion.name}
    >
      <div className='flex flex-col gap-4'>
        <div className='flex items-center gap-3'>
          <ChampionPortrait
            champion={champion}
            size={96}
            frame={board.frame}
          />
          <div className='flex flex-col gap-1 text-xs text-muted-foreground'>
            <span className='text-sm font-semibold text-foreground'>{champion.name}</span>
            <span>{champion.championClass}</span>
            {champion.alias && <span className='italic'>{champion.alias}</span>}
            <span>
              {champion.isAscendable ? '★ ASC' : '—'} · {champion.hasPrefight ? 'Prefight' : '—'}
            </span>
          </div>
        </div>

        <section className='flex flex-col gap-2'>
          <h3 className='text-xs font-bold uppercase tracking-wide text-muted-foreground'>
            {t.editAttributes}
          </h3>
          <div className='flex flex-wrap gap-1.5'>
            {ATTRIBUTE_LIST.map((def) => {
              const Icon = attributeIcon(def.key, board.iconChoices[def.key])
              return (
                <ToggleChip
                  key={def.key}
                  on={!!attrs.flags[def.key]}
                  onToggle={() => actions.toggleAttribute(champion.id, def.key)}
                  accent={def.accent}
                >
                  <Icon className='h-4 w-4' />
                  {def.code}
                </ToggleChip>
              )
            })}
          </div>

          {attrs.flags.awk && (
            <div className='flex flex-wrap items-center gap-2 rounded-md border border-border bg-elevated p-2'>
              <label
                htmlFor='sig-value'
                className='text-xs font-semibold text-muted-foreground'
              >
                {t.sigValue}
              </label>
              <input
                id='sig-value'
                type='number'
                min={0}
                max={999}
                value={attrs.sig ?? ''}
                placeholder='200'
                onChange={(e) =>
                  actions.setSignature(
                    champion.id,
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
                className='w-20 rounded border border-border bg-input px-2 py-1 text-sm outline-none focus:border-ring'
              />
              {SIG_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type='button'
                  onClick={() => actions.setSignature(champion.id, preset)}
                  className='rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground'
                >
                  x{preset}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className='flex flex-col gap-2'>
          <h3 className='text-xs font-bold uppercase tracking-wide text-muted-foreground'>
            {t.sendToTier}
          </h3>
          <div className='flex flex-wrap gap-1.5'>
            {board.tiers.map((tier) => (
              <button
                key={tier.id}
                type='button'
                onClick={() => actions.moveChampion(champion.id, tier.id)}
                disabled={tier.id === currentTier?.id}
                style={{ backgroundColor: tier.color, color: readableTextColor(tier.color) }}
                className='rounded-md px-3 py-1 text-sm font-black disabled:opacity-40'
              >
                {tier.label}
              </button>
            ))}
            <button
              type='button'
              onClick={() => actions.moveChampion(champion.id, POOL_ID)}
              disabled={!currentTier}
              className='rounded-md border border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40'
            >
              {t.removeFromBoard}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  )
}
