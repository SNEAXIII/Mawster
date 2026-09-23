import { useMemo } from 'react'
import { useGameAccounts } from '@/app/contexts/game-accounts-context'

/** Splits a player list into the signed-in user's own accounts and everyone else, order kept. */
export function useOwnPlayersFirst(players: string[]) {
  const { accounts } = useGameAccounts()
  return useMemo(() => {
    const mine = new Set(accounts.map((a) => a.game_pseudo))
    return {
      own: players.filter((p) => mine.has(p)),
      others: players.filter((p) => !mine.has(p)),
    }
  }, [players, accounts])
}
