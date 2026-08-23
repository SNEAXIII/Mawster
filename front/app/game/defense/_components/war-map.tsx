'use client'

import { type DefensePlacement } from '@/app/services/defense'
import ChampionPortrait from '@/components/champion-portrait'
import { cn } from '@/app/lib/utils'
import { X, StickyNote } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { rarityBadgeClass, rarityLabel, parseRarity } from './defense-utils'
import { mapSectionsForFormat } from './war-format'
import type { SeasonFormat } from '@/app/services/season'

interface WarMapNodeProps {
  nodeNumber: number
  placement: DefensePlacement | null
  onNodeClick: (nodeNumber: number) => void
  onRemove: (nodeNumber: number) => void
  canManage: boolean
  colorClasses: string
  hoverClasses: string
  hidePseudo?: boolean
  hideSig?: boolean
  dimmed?: boolean
  hasPrefight?: boolean
  hasNote?: boolean
}

/**
 * Compact node geometry. The portrait fills the cell edge to edge, so the cell
 * is exactly as tall as the star frame renders (frames are 1.218:1) plus the
 * optional pseudo line — no dead space, no fixed magic heights.
 */
const NODE_WIDTH = 56
const BORDER = 2
/** 1px of breathing room so the cell's coloured border stays visible on the left. */
const PAD_LEFT = 1
const PORTRAIT = NODE_WIDTH - BORDER * 2 - PAD_LEFT
const PORTRAIT_HEIGHT = Math.round(PORTRAIT / (212 / 174))
const PSEUDO_HEIGHT = 12

export function WarMapPlaceHolder() {
  return <div className='w-2'></div>
}

/** "7R4·A2" when signatures are hidden, "R4·200·A1" otherwise. */
function nodeRarityLabel(placement: DefensePlacement, hideSig: boolean): string {
  if (!hideSig) return rarityLabel(placement.rarity, placement.signature, placement.ascension)
  const { stars, rank } = parseRarity(placement.rarity)
  const parts = [`${stars}R${rank}`]
  if (placement.ascension > 0) parts.push(`A${placement.ascension}`)
  return parts.join('·')
}

export function WarMapNode({
  nodeNumber,
  placement,
  onNodeClick,
  onRemove,
  canManage,
  colorClasses,
  hoverClasses,
  hidePseudo = false,
  hideSig = false,
  dimmed = false,
  hasPrefight = false,
  hasNote = false,
}: Readonly<WarMapNodeProps>) {
  const { t } = useI18n()
  // The line is reserved for every node so rows keep one height, and an empty
  // one on a placed defender means "no attacker assigned" rather than "hidden".
  const showPseudo = !hidePseudo

  return (
    <div
      role='button'
      tabIndex={0}
      className={cn(
        'group relative rounded-md border-2 cursor-pointer transition-all',
        colorClasses,
        hoverClasses,
        hasPrefight && 'ring-2 ring-foreground',
        !hasPrefight && !dimmed && placement && 'ring-1 ring-white/30',
        // Empty nodes recede so the eye lands on what is actually placed.
        !placement && 'border-dashed opacity-45 hover:opacity-80',
        dimmed && 'opacity-25'
      )}
      style={{
        width: NODE_WIDTH,
        height: PORTRAIT_HEIGHT + BORDER * 2 + (showPseudo ? PSEUDO_HEIGHT : 0),
      }}
      onClick={() => onNodeClick(nodeNumber)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onNodeClick(nodeNumber)
      }}
      title={
        placement
          ? `#${nodeNumber} – ${placement.champion_name} (${placement.game_pseudo})`
          : t.game.defense.nodeEmpty.replace('{node}', String(nodeNumber))
      }
      data-cy={`war-node-${nodeNumber}`}
    >
      <div
        className='relative w-full'
        style={{ height: PORTRAIT_HEIGHT, paddingLeft: PAD_LEFT }}
      >
        {placement ? (
          <>
            <ChampionPortrait
              imageUrl={placement.champion_image_url}
              name={placement.champion_name}
              rarity={placement.rarity}
              size={PORTRAIT}
              box='frame'
              isPreferred={placement.is_preferred_attacker}
              ascension={placement.ascension}
              is_saga_attacker={placement.is_saga_attacker}
              is_saga_defender={placement.is_saga_defender}
              sagaMode='defender'
            />
            {/* Rarity over the frame's bottom band */}
            <span
              className={cn(
                'absolute inset-x-0 bottom-0 z-40 rounded-b bg-black/70 text-center text-[9px] font-semibold leading-[11px]',
                rarityBadgeClass(placement.rarity)
              )}
            >
              {nodeRarityLabel(placement, hideSig)}
            </span>
          </>
        ) : (
          <span className='absolute inset-0 flex items-center justify-center text-[10px] text-white/30'>
            +
          </span>
        )}

        {/* Node number — inside the cell so it never collides with its neighbour,
            and above the portrait badges (z-30) since it must always be readable */}
        <span className='absolute top-0 left-0 z-40 rounded-br bg-black/70 px-1 text-[9px] font-bold leading-[13px] text-white'>
          {nodeNumber}
        </span>

        {/* Remove — hover-revealed on desktop, always reachable on touch. It sits
            on the ascension badge, whose level is also in the rarity label. */}
        {placement && canManage && (
          <button
            className='absolute top-0 right-0 z-40 flex size-4 items-center justify-center rounded-bl bg-red-600 text-white opacity-100 transition-opacity hover:bg-red-700 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
            onClick={(e) => {
              e.stopPropagation()
              onRemove(nodeNumber)
            }}
            title={t.game.defense.removeDefender}
          >
            <X className='size-2.5' />
          </button>
        )}

        {hasNote && (
          <span
            className='absolute right-0 bottom-2.75 z-40 flex items-center justify-center rounded-l bg-amber-500 p-0.5 text-white'
            data-cy={`war-node-has-note-${nodeNumber}`}
            title={t.game.war.noteLabel}
          >
            <StickyNote className='size-2' />
          </span>
        )}
      </div>

      {showPseudo && (
        <span
          className={cn(
            'block truncate px-0.5 text-center text-[9px] leading-[12px]',
            placement?.game_pseudo ? 'text-white/80' : 'text-white/30'
          )}
          style={{ height: PSEUDO_HEIGHT }}
          title={placement && !placement.game_pseudo ? t.game.war.noAttackerAssigned : undefined}
          data-cy={
            placement && !placement.game_pseudo ? `war-node-unassigned-${nodeNumber}` : undefined
          }
        >
          {placement && !placement.game_pseudo ? '—' : placement?.game_pseudo}
        </span>
      )}
    </div>
  )
}

// ─── War Map Grid ────────────────────────────────────────

interface WarMapProps {
  placements: DefensePlacement[]
  onNodeClick: (nodeNumber: number) => void
  onRemove: (nodeNumber: number) => void
  canManage: boolean
  hidePseudo?: boolean
  hideSig?: boolean
  dimmedNodes?: Set<number>
  prefightNodes?: Set<number>
  noteNodes?: Set<number>
  format?: SeasonFormat
}

export default function WarMap({
  placements,
  onNodeClick,
  onRemove,
  canManage,
  hidePseudo = false,
  hideSig = false,
  dimmedNodes,
  prefightNodes,
  noteNodes,
  format = 'regular',
}: Readonly<WarMapProps>) {
  const sections = mapSectionsForFormat(format)
  const placementMap = new Map<number, DefensePlacement>()
  for (const p of placements) {
    placementMap.set(p.node_number, p)
  }

  return (
    <div className='flex flex-col items-center gap-1'>
      {sections.map((section) => (
        <div
          key={section.label}
          className='flex flex-col items-center gap-1 w-full'
        >
          {/* Section label, sitting on its own rule instead of above it */}
          <div className='mt-1.5 mb-1 flex w-3/4 items-center gap-2'>
            <span className={cn('flex-1 border-t', section.borderColor)} />
            <span className={cn('text-[10px] font-bold tracking-wider uppercase', section.color)}>
              {section.label}
            </span>
            <span className={cn('flex-1 border-t', section.borderColor)} />
          </div>

          {section.rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className='flex gap-2 justify-center'
            >
              {row.map((nodeNumber, index) =>
                nodeNumber === 0 ? (
                  <WarMapPlaceHolder key={`${rowIdx}-${index}`} />
                ) : (
                  <WarMapNode
                    key={nodeNumber}
                    nodeNumber={nodeNumber}
                    placement={placementMap.get(nodeNumber) ?? null}
                    onNodeClick={onNodeClick}
                    onRemove={onRemove}
                    canManage={canManage}
                    colorClasses={section.nodeColor}
                    hoverClasses={section.nodeHoverColor}
                    hidePseudo={hidePseudo}
                    hideSig={hideSig}
                    dimmed={dimmedNodes?.has(nodeNumber) ?? false}
                    hasPrefight={prefightNodes?.has(nodeNumber) ?? false}
                    hasNote={noteNodes?.has(nodeNumber) ?? false}
                  />
                )
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
