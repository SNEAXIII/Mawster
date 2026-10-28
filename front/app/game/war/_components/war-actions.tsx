'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { List, ListPlus, Map as MapIcon, Pencil, Trash2 } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { useWar } from '@/app/contexts/war-context'
import { Button } from '@/components/ui/button'

const WarQuickEdit = dynamic(() => import('./quick-edit/war-quick-edit'), { loading: () => null })

interface WarActionsProps {
  onEditClick: () => void
  onExportMap: () => void
  onExportList: () => void
  exporting: boolean
}

/** War actions as icon buttons, so the toolbar stays one row; only ending the war keeps a label. */
export default function WarActions({
  onEditClick,
  onExportMap,
  onExportList,
  exporting,
}: Readonly<WarActionsProps>) {
  const { t } = useI18n()
  const {
    canManageWar,
    canPlaceWar,
    isWarClosed,
    placements,
    setShowClearConfirm,
    setShowEndConfirm,
  } = useWar()
  const [quickEditOpen, setQuickEditOpen] = useState(false)

  const canManageOpenWar = canManageWar && !isWarClosed
  const canExport = placements.length > 0
  const canClear = canPlaceWar && !isWarClosed && placements.length > 0

  const iconButtons = [
    canPlaceWar && {
      cy: 'war-quick-edit-btn',
      label: t.game.war.quickEdit.button,
      icon: <ListPlus />,
      onClick: () => setQuickEditOpen(true),
    },
    canManageOpenWar && {
      cy: 'edit-war-btn',
      label: t.game.war.editWar,
      icon: <Pencil />,
      onClick: onEditClick,
    },
    canExport && {
      cy: 'export-war-map-btn',
      label: t.game.war.exportMap,
      icon: <MapIcon />,
      onClick: onExportMap,
    },
    canExport && {
      cy: 'export-war-list-btn',
      label: t.game.war.exportList,
      icon: <List />,
      onClick: onExportList,
    },
    canClear && {
      cy: 'clear-war-bg-btn',
      label: t.game.war.clearAll,
      icon: <Trash2 />,
      onClick: () => setShowClearConfirm(true),
    },
  ].filter((b): b is Exclude<typeof b, false> => b !== false)

  return (
    <>
      {iconButtons.map((b) => (
        <Button
          key={b.cy}
          variant='outline'
          size='icon'
          onClick={b.onClick}
          disabled={exporting}
          aria-label={b.label}
          title={b.label}
          data-cy={b.cy}
        >
          {b.icon}
        </Button>
      ))}
      {canManageOpenWar && (
        <Button
          variant='destructive'
          size='sm'
          onClick={() => setShowEndConfirm(true)}
          data-cy='end-war-btn'
        >
          {t.game.war.endWar}
        </Button>
      )}
      {canPlaceWar && (
        <WarQuickEdit
          open={quickEditOpen}
          onClose={() => setQuickEditOpen(false)}
        />
      )}
    </>
  )
}
