'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ChampionPortrait from '@/components/champion-portrait';
import PrefightSelectorDialog from './prefight-selector';
import AssistSelectorDialog from './assist-selector';
import WarNoteEditor from './war-note-editor';
import { useWar } from '@/app/contexts/war-context';

interface NodeActionsPopoverProps {
  nodeNumber: number;
  gameAccountId: string;
  championName: string;
  imageUrl: string | null;
  rarity: string;
  size?: number;
  isPreferred?: boolean;
  ascension?: number;
  is_saga_attacker?: boolean;
  is_saga_defender?: boolean;
  canManage?: boolean;
}

export default function NodeActionsPopover({
  nodeNumber,
  gameAccountId,
  championName,
  imageUrl,
  rarity,
  size = 35,
  isPreferred = false,
  ascension = 0,
  is_saga_attacker = false,
  is_saga_defender = false,
  canManage = true,
}: Readonly<NodeActionsPopoverProps>) {
  const { t } = useI18n();
  const { prefights, handleRemovePrefight, placements, handleRemoveAssist } = useWar();
  const [open, setOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [assistSelectorOpen, setAssistSelectorOpen] = useState(false);

  // prefights targeting this specific node
  const boundPrefights = prefights.filter((p) => p.target_node_number === nodeNumber);
  const placement = placements.find((p) => p.node_number === nodeNumber);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <button
            className='relative focus:outline-none'
            data-cy={`node-actions-trigger-node-${nodeNumber}`}
          >
            <ChampionPortrait
              imageUrl={imageUrl}
              name={championName}
              rarity={rarity}
              size={size}
              isPreferred={isPreferred}
              ascension={ascension}
              is_saga_attacker={is_saga_attacker}
              is_saga_defender={is_saga_defender}
              sagaMode='attacker'
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className='w-52 p-3 flex flex-col gap-2'
          side='top'
        >
          <p className='text-[11px] font-semibold truncate'>
            #{nodeNumber} — {championName}
          </p>
          {boundPrefights.length > 0 && (
            <div className='flex flex-col gap-1'>
              <p className='text-[10px] text-muted-foreground'>{t.game.war.prefight.label}</p>
              {boundPrefights.map((p) => (
                <div
                  key={p.champion_user_id}
                  className='flex items-center gap-2'
                >
                  <ChampionPortrait
                    imageUrl={p.image_url}
                    name={p.champion_name}
                    rarity={p.rarity}
                    size={32}
                    ascension={p.ascension}
                    is_saga_attacker={p.is_saga_attacker}
                    is_saga_defender={p.is_saga_defender}
                    sagaMode='attacker'
                  />
                  <div className='flex flex-col flex-1 min-w-0'>
                    <span className='text-xs font-medium truncate'>{p.champion_name}</span>
                    <span className='text-[10px] text-muted-foreground truncate'>
                      {p.game_pseudo}
                    </span>
                  </div>
                  <button
                    className='shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                    data-cy={`prefight-revoke-${p.champion_name.replaceAll(/\s+/g, '-')}`}
                    disabled={!canManage}
                    onClick={async () => {
                      setOpen(false);
                      await handleRemovePrefight(p.champion_user_id);
                    }}
                  >
                    {t.game.war.prefight.revoke}
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            className='w-full text-xs py-1 px-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
            data-cy={`prefight-add-node-${nodeNumber}`}
            disabled={!canManage}
            onClick={() => {
              setOpen(false);
              setSelectorOpen(true);
            }}
          >
            {t.game.war.prefight.add}
          </button>

          <div className='border-t border-border/40 pt-2 flex flex-col gap-1'>
            <p className='text-[10px] text-muted-foreground'>{t.game.war.assist.label}</p>
            {placement?.is_assisted && placement.assistor_champion_name ? (
              <div className='flex items-center gap-2'>
                <ChampionPortrait
                  imageUrl={placement.assistor_image_url ?? null}
                  name={placement.assistor_champion_name}
                  rarity={placement.assistor_rarity ?? ''}
                  size={32}
                  ascension={placement.assistor_ascension ?? 0}
                  is_saga_attacker={false}
                  is_saga_defender={false}
                  sagaMode='attacker'
                />
                <div className='flex flex-col flex-1 min-w-0'>
                  <span className='text-xs font-medium truncate'>{placement.assistor_champion_name}</span>
                  <span className='text-[10px] text-muted-foreground truncate'>
                    {placement.assistor_pseudo}
                  </span>
                </div>
                <button
                  className='shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                  data-cy={`assist-revoke-node-${nodeNumber}`}
                  disabled={!canManage}
                  onClick={async () => {
                    setOpen(false);
                    await handleRemoveAssist(nodeNumber);
                  }}
                >
                  {t.game.war.assist.revoke}
                </button>
              </div>
            ) : (
              <button
                className='w-full text-xs py-1 px-2 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                data-cy={`assist-add-node-${nodeNumber}`}
                disabled={!canManage}
                onClick={() => {
                  setOpen(false);
                  setAssistSelectorOpen(true);
                }}
              >
                {t.game.war.assist.add}
              </button>
            )}
          </div>

          <WarNoteEditor
            nodeNumber={nodeNumber}
            note={placement?.note ?? null}
            noteId={placement?.note_id ?? null}
            noteBlocked={placement?.note_blocked ?? false}
            canManage={canManage}
            onSaved={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>

      <PrefightSelectorDialog
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        targetNodeNumber={nodeNumber}
        targetGameAccountId={gameAccountId}
      />
      <AssistSelectorDialog
        open={assistSelectorOpen}
        onClose={() => setAssistSelectorOpen(false)}
        nodeNumber={nodeNumber}
        attackerGameAccountId={placement?.attacker_game_account_id ?? null}
      />
    </>
  );
}
