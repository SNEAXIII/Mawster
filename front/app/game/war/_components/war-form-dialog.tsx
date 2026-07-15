'use client'

import { useEffect, useMemo, useState } from 'react'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { useI18n } from '@/app/i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiX } from 'react-icons/fi'
import { type Champion, getChampions } from '@/app/services/champions'
import ChampionPortrait from '@/components/champion-portrait'

// todo max ban automatique
const MAX_BANS = 7

let championsCache: Champion[] | null = null

interface WarFormDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (opponentName: string, bannedChampionIds: string[]) => Promise<void>
  mode?: 'create' | 'edit'
  initialOpponentName?: string
  initialBannedIds?: string[]
}

export default function WarFormDialog({
  open,
  onClose,
  onConfirm,
  mode = 'create',
  initialOpponentName = '',
  initialBannedIds = [],
}: WarFormDialogProps) {
  const { t } = useI18n()
  const [opponentName, setOpponentName] = useState(initialOpponentName)
  const [loading, setLoading] = useState(false)
  const [champions, setChampions] = useState<Champion[]>([])
  const [search, setSearch] = useState('')
  const [bannedIds, setBannedIds] = useState<string[]>(initialBannedIds)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setOpponentName(initialOpponentName)
    setBannedIds(initialBannedIds)
    if (championsCache) {
      setChampions(championsCache)
    } else {
      getChampions(1, 9999)
        .then((res) => {
          championsCache = res.champions
          setChampions(res.champions)
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const bannedSet = useMemo(() => new Set(bannedIds), [bannedIds])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return champions.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true
      if (!c.alias) return false
      return c.alias.split(';').some((a) => a.trim().toLowerCase().includes(q))
    })
  }, [search, champions])

  const bannedChampions = useMemo(
    () => champions.filter((c) => bannedSet.has(c.id)),
    [champions, bannedSet]
  )

  const toggleBan = (id: string) => {
    setBannedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_BANS) return prev
      return [...prev, id]
    })
  }

  const handleClose = () => {
    setOpponentName('')
    setBannedIds([])
    setSearch('')
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!opponentName.trim()) return
    if (mode === 'create') {
      setConfirmOpen(true)
    } else {
      doConfirm()
    }
  }

  const doConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(opponentName.trim(), bannedIds)
      setOpponentName('')
      setBannedIds([])
      setSearch('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const isCreate = mode === 'create'
  const title = isCreate ? t.game.war.declareWar : t.game.war.editWar

  return (
    <>
      {isCreate && (
        <ConfirmationDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t.game.war.declareWar}
          description={t.game.war.declareWarConfirmDesc.replace('{name}', opponentName.trim())}
          onConfirm={() => {
            setConfirmOpen(false)
            doConfirm()
          }}
          requireConfirmText='confirm'
        />
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => !o && handleClose()}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='flex flex-col gap-4 py-4'>
              <div>
                <Label htmlFor='opponent-name'>{t.game.war.opponentName}</Label>
                <Input
                  id='opponent-name'
                  value={opponentName}
                  onChange={(e) => setOpponentName(e.target.value)}
                  placeholder='e.g. Mighty Warriors'
                  autoFocus
                  className='mt-2'
                  data-cy='opponent-name-input'
                />
              </div>

              <div>
                <Label>
                  {t.game.war.bans.label}
                  <span className='text-muted-foreground ml-1 font-normal'>
                    ({bannedIds.length}/{MAX_BANS})
                  </span>
                </Label>

                {bannedChampions.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {bannedChampions.map((c) => (
                      <button
                        key={c.id}
                        type='button'
                        title={c.name}
                        className='relative group'
                        onClick={() => toggleBan(c.id)}
                        data-cy={`ban-badge-${c.id}`}
                      >
                        <ChampionPortrait
                          imageUrl={c.image_url}
                          name={c.name}
                          rarity='7r6'
                          size={50}
                        />
                        <div className='absolute inset-0 rounded bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none'>
                          <FiX className='text-white size-4' />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.game.war.bans.placeholder}
                  className='mt-2'
                  data-cy='ban-search-input'
                  disabled={bannedIds.length >= MAX_BANS}
                />

                {filtered.length > 0 && (
                  <div className='border rounded-md mt-1 max-h-48 overflow-y-auto bg-popover'>
                    {filtered.slice(0, 5).map((c) => {
                      const selected = bannedSet.has(c.id)
                      return (
                        <button
                          key={c.id}
                          type='button'
                          className={`w-full text-left px-2 py-1 text-sm hover:bg-accent flex items-center gap-2 ${selected ? 'bg-accent/50' : ''}`}
                          onClick={() => {
                            toggleBan(c.id)
                            setSearch('')
                          }}
                          data-cy={`ban-option-${c.id}`}
                        >
                          <ChampionPortrait
                            imageUrl={c.image_url}
                            name={c.name}
                            rarity='7r6'
                            size={40}
                          />
                          <span className={selected ? 'font-medium' : ''}>{c.name}</span>
                          <span className='text-muted-foreground text-xs ml-auto'>
                            {c.champion_class}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={handleClose}
              >
                {t.common.cancel}
              </Button>
              <Button
                type='submit'
                disabled={!opponentName.trim() || loading}
                data-cy={isCreate ? 'create-war-confirm' : 'edit-war-confirm'}
              >
                {loading ? '...' : isCreate ? t.game.war.declareWar : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
