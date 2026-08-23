'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useI18n } from '@/app/i18n'

interface EndWarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasSeason: boolean
  currentElo: number
  onConfirm: (win: boolean, eloChange: number | null) => void
}

export default function EndWarDialog({
  open,
  onOpenChange,
  hasSeason,
  currentElo,
  onConfirm,
}: Readonly<EndWarDialogProps>) {
  const { t } = useI18n()
  const [win, setWin] = useState(true)
  const [eloInput, setEloInput] = useState('')
  const [confirmInput, setConfirmInput] = useState('')

  const parsedElo = eloInput === '' ? null : Number(eloInput)
  const eloValid = !hasSeason || (parsedElo !== null && !isNaN(parsedElo) && parsedElo > 0)
  const signedElo = parsedElo === null ? null : win ? parsedElo : -parsedElo
  // Mirrors the backend clamp in WarService.end_war so the preview never
  // promises an ELO the API will not actually store.
  const nextElo = signedElo === null ? null : Math.max(0, Math.min(4500, currentElo + signedElo))
  const confirmed = confirmInput.trim().toLowerCase() === 'confirm'

  function handleConfirm() {
    if (!eloValid || !confirmed) return
    onConfirm(win, hasSeason ? signedElo : null)
    onOpenChange(false)
    setEloInput('')
    setConfirmInput('')
    setWin(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent data-cy='end-war-dialog'>
        <DialogHeader>
          <DialogTitle>{t.game.war.endWarConfirmTitle}</DialogTitle>
          <DialogDescription>{t.game.war.endWarConfirmDesc}</DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4 py-2'>
          <div
            className='flex items-center gap-3'
            data-cy='end-war-win-toggle'
          >
            <Label>{t.game.war.result}</Label>
            <div className='flex items-center gap-2'>
              <span
                className={
                  win ? 'text-sm font-semibold text-green-500' : 'text-sm text-muted-foreground'
                }
              >
                {t.game.war.win}
              </span>
              <Switch
                checked={!win}
                onCheckedChange={(checked) => {
                  setWin(!checked)
                  setEloInput('')
                }}
                data-cy='end-war-win-switch'
              />
              <span
                className={
                  !win ? 'text-sm font-semibold text-destructive' : 'text-sm text-muted-foreground'
                }
              >
                {t.game.war.lose}
              </span>
            </div>
          </div>

          {hasSeason && (
            <div className='flex flex-col gap-1'>
              <Label htmlFor='elo-change'>{win ? t.game.war.eloGained : t.game.war.eloLost}</Label>
              <Input
                id='elo-change'
                type='number'
                min='1'
                placeholder='30'
                value={eloInput}
                onChange={(e) => setEloInput(e.target.value)}
                data-cy='end-war-elo-input'
              />
              {eloInput !== '' && !eloValid && (
                <p
                  className='text-xs text-destructive'
                  data-cy='end-war-elo-error'
                >
                  {t.game.war.eloMustBePositive}
                </p>
              )}
              <div
                className='flex items-center gap-2 text-sm'
                data-cy='end-war-elo-preview'
              >
                <span className='text-muted-foreground'>{t.game.war.currentElo}</span>
                <span className='font-medium'>{currentElo}</span>
                {nextElo !== null && eloValid && (
                  <>
                    <span className='text-muted-foreground'>&rarr;</span>
                    <span
                      className={
                        win ? 'font-semibold text-green-500' : 'font-semibold text-destructive'
                      }
                      data-cy='end-war-elo-next'
                    >
                      {nextElo}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <Input
            placeholder='confirm'
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            data-cy='end-war-confirm-input'
          />
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            data-cy='end-war-cancel'
          >
            {t.common.cancel}
          </Button>
          <Button
            variant='destructive'
            disabled={!eloValid || !confirmed}
            onClick={handleConfirm}
            data-cy='confirmation-dialog-confirm'
          >
            {t.game.war.endWar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
