'use client';

import { useI18n } from '@/app/i18n';

export default function SeasonBansPlaceholder() {
  const { t } = useI18n();
  // TODO: implement season-wide ban management (display + enforce banned champions for the season)
  return (
    <div
      data-cy="season-bans-section"
      className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground"
    >
      <p className="font-medium mb-1">{t.game.season.bans.title}</p>
      <p>{t.game.season.bans.comingSoon}</p>
    </div>
  );
}
