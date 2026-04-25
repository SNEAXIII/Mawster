'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FiX } from 'react-icons/fi';
import { type Champion, getChampions } from '@/app/services/champions';
import ChampionPortrait from '@/components/champion-portrait';

const MAX_BANS = 6;

interface CreateWarDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (opponentName: string, bannedChampionIds: string[]) => Promise<void>;
}

export default function CreateWarDialog({ open, onClose, onConfirm }: CreateWarDialogProps) {
  const { t } = useI18n();
  const [opponentName, setOpponentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [search, setSearch] = useState('');
  const [bannedIds, setBannedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    getChampions(1, 9999)
      .then((res) => setChampions(res.champions))
      .catch(() => {});
  }, [open]);

  const filtered = search.trim()
    ? champions.filter((c) => {
        const q = search.trim().toLowerCase();
        if (c.name.toLowerCase().includes(q)) return true;
        if (!c.alias) return false;
        return c.alias.split(';').some((a) => a.trim().toLowerCase().includes(q));
      })
    : [];

  const bannedChampions = champions.filter((c) => bannedIds.includes(c.id));

  const toggleBan = (id: string) => {
    setBannedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_BANS) return prev;
      return [...prev, id];
    });
  };

  const handleClose = () => {
    setOpponentName('');
    setBannedIds([]);
    setSearch('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponentName.trim()) return;
    setLoading(true);
    try {
      await onConfirm(opponentName.trim(), bannedIds);
      setOpponentName('');
      setBannedIds([]);
      setSearch('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && handleClose()}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t.game.war.declareWar}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className='space-y-4 py-4'>
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

              {/* Selected bans */}
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
                        <FiX className='text-white w-4 h-4' />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Search input */}
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.game.war.bans.placeholder}
                className='mt-2'
                data-cy='ban-search-input'
                disabled={bannedIds.length >= MAX_BANS}
              />

              {/* Dropdown results */}
              {filtered.length > 0 && (
                <div className='border rounded-md mt-1 max-h-48 overflow-y-auto bg-popover'>
                  {filtered.slice(0, 20).map((c) => {
                    const selected = bannedIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type='button'
                        className={`w-full text-left px-2 py-1 text-sm hover:bg-accent flex items-center gap-2 ${selected ? 'bg-accent/50' : ''}`}
                        onClick={() => {
                          toggleBan(c.id);
                          setSearch('');
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
                    );
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
              data-cy='create-war-confirm'
            >
              {loading ? '...' : t.game.war.declareWar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
