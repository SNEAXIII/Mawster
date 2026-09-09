'use client'

import { useMemo } from 'react'
import { useI18n } from '@/app/i18n'
import type { SeasonWarStats } from '@/app/services/statistics'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const BATTLEGROUPS = [1, 2, 3]

function resultTextClass(win: boolean | null): string {
  if (win === null) return ''
  return win ? 'text-green-500' : 'text-destructive'
}

/** Green on the fewest deaths, red on the most, neutral in between.
 *  Equal values share a colour, so a tie never reads as a gap. */
function battlegroupToneClass(value: number, row: number[]): string {
  const min = Math.min(...row)
  const max = Math.max(...row)
  if (min === max) return ''
  if (value === min) return 'text-green-500'
  if (value === max) return 'text-destructive'
  return ''
}

function deathsOf(war: SeasonWarStats, battlegroup: number): number {
  return war.battlegroups.find((bg) => bg.battlegroup === battlegroup)?.deaths ?? 0
}

function ResultBadge({ win }: Readonly<{ win: boolean | null }>) {
  const { t } = useI18n()
  const seasonWars = t.game.alliances.statistics.seasonWars
  if (win === null) return <span className='text-muted-foreground'>—</span>
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-semibold ${
        win ? 'bg-green-600 text-white' : 'bg-destructive text-destructive-foreground'
      }`}
    >
      {win ? seasonWars.victory : seasonWars.defeat}
    </span>
  )
}

function BattlegroupCells({
  values,
  format,
  bold,
}: Readonly<{ values: number[]; format?: (v: number) => string; bold?: boolean }>) {
  return (
    <>
      {values.map((value, index) => (
        <TableCell
          key={BATTLEGROUPS[index]}
          className={`py-1.5 text-right ${bold ? 'font-semibold' : ''} ${battlegroupToneClass(
            value,
            values
          )}`}
          data-cy={`season-war-bg${BATTLEGROUPS[index]}`}
        >
          {format ? format(value) : value}
        </TableCell>
      ))}
    </>
  )
}

export function AllianceSeasonWarsTable({
  wars,
  allianceTag,
}: Readonly<{ wars: SeasonWarStats[]; allianceTag: string }>) {
  const { t } = useI18n()
  const seasonWars = t.game.alliances.statistics.seasonWars

  // Averages divide by the wars actually played, never by a fixed season length.
  const totals = useMemo(() => {
    const opponent = wars.reduce((sum, w) => sum + (w.opponent_deaths ?? 0), 0)
    const own = wars.reduce((sum, w) => sum + w.total_deaths, 0)
    const perBg = BATTLEGROUPS.map((bg) => wars.reduce((sum, w) => sum + deathsOf(w, bg), 0))
    const count = wars.length || 1
    return { opponent, own, perBg, perBgAverage: perBg.map((v) => v / count), count }
  }, [wars])

  const average = (value: number) => (value / totals.count).toFixed(2)

  if (wars.length === 0) {
    return (
      <p
        className='py-4 text-center text-sm text-muted-foreground'
        data-cy='season-wars-empty'
      >
        {seasonWars.empty}
      </p>
    )
  }

  return (
    <div
      className='overflow-x-auto'
      data-cy='season-wars-table'
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{seasonWars.war}</TableHead>
            <TableHead>{seasonWars.opponent}</TableHead>
            <TableHead className='text-center'>{seasonWars.result}</TableHead>
            <TableHead className='text-right'>{seasonWars.deathsOpponent}</TableHead>
            <TableHead className='text-right'>
              {seasonWars.deathsAlliance.replace('{tag}', allianceTag)}
            </TableHead>
            {BATTLEGROUPS.map((bg) => (
              <TableHead
                key={bg}
                className='text-right'
              >
                {seasonWars.deathsBattlegroup.replace('{number}', String(bg))}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {wars.map((war) => (
            <TableRow
              key={war.war_id}
              data-cy={`season-war-row-${war.war_id}`}
            >
              <TableCell className='py-1.5 font-medium whitespace-nowrap'>
                {seasonWars.warNumber.replace('{number}', String(war.war_number))}
              </TableCell>
              <TableCell className='py-1.5 font-semibold'>{war.opponent_name}</TableCell>
              <TableCell className='py-1.5 text-center'>
                <ResultBadge win={war.win} />
              </TableCell>
              <TableCell className='py-1.5 text-right'>
                {war.opponent_deaths ?? <span className='text-muted-foreground'>—</span>}
              </TableCell>
              <TableCell
                className={`py-1.5 text-right font-semibold ${resultTextClass(war.win)}`}
                data-cy={`season-war-deaths-${war.war_id}`}
              >
                {war.total_deaths}
              </TableCell>
              <BattlegroupCells values={BATTLEGROUPS.map((bg) => deathsOf(war, bg))} />
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow data-cy='season-wars-totals'>
            <TableCell
              className='py-1.5 font-semibold'
              colSpan={3}
            >
              {seasonWars.totalDeaths}
            </TableCell>
            <TableCell className='py-1.5 text-right font-semibold'>{totals.opponent}</TableCell>
            <TableCell className='py-1.5 text-right font-semibold'>{totals.own}</TableCell>
            <BattlegroupCells
              values={totals.perBg}
              bold
            />
          </TableRow>
          <TableRow data-cy='season-wars-averages'>
            <TableCell
              className='py-1.5 font-semibold'
              colSpan={3}
            >
              {seasonWars.averageDeaths}
            </TableCell>
            <TableCell className='py-1.5 text-right'>{average(totals.opponent)}</TableCell>
            <TableCell className='py-1.5 text-right'>{average(totals.own)}</TableCell>
            <BattlegroupCells
              values={totals.perBgAverage}
              format={(v) => v.toFixed(2)}
            />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
