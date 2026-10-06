import { useTranslation } from 'react-i18next';
import { CONFLICT_STATUSES, type ConflictCheck } from '@shared/types';
import { useFirm } from '../store/useFirm';
import { CONFLICT_COLORS } from './conflictStyles';

/** Sélecteur de statut d'une vérification (changement journalisé avec les initiales de la session). */
export function ConflictStatusSelect({ check }: { check: ConflictCheck }) {
  const { t } = useTranslation();
  const update = useFirm((s) => s.updateConflictCheck);
  return (
    <select
      aria-label={t('conflicts.statusLabel')}
      value={check.status}
      onChange={(e) => void update(check.id, { status: e.target.value as ConflictCheck['status'] })}
      onClick={(e) => e.stopPropagation()}
      className="h-6 rounded-full px-2 text-[10px] font-bold uppercase text-white outline-none"
      style={{ background: CONFLICT_COLORS[check.status] }}
    >
      {CONFLICT_STATUSES.map((s) => (
        <option key={s} value={s} className="bg-white text-[var(--color-ink)]">{t(`conflicts.status.${s}`)}</option>
      ))}
    </select>
  );
}
