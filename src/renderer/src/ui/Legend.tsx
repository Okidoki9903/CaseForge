import { useTranslation } from 'react-i18next';
import { ALERT_COLORS, ALERT_LEVELS } from '@shared/domain/alerts';
import { LOAD_COLORS } from '../scene/palette';

export function Legend() {
  const { t } = useTranslation();
  return (
    <div className="glass pointer-events-auto absolute bottom-3 right-3 z-20 rounded-xl px-3 py-2 text-[11px]">
      <div className="mb-1 font-semibold text-[var(--color-muted)]">{t('legend.title')}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {ALERT_LEVELS.map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ALERT_COLORS[l] }} /> {t(`level.${l}`)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="grid h-3 w-3 place-items-center rounded-full bg-[#8e4ec6] text-[8px] text-white">⚖</span> {t('conflicts.potential')}
        </span>
        {(Object.keys(LOAD_COLORS) as (keyof typeof LOAD_COLORS)[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: LOAD_COLORS[l] }} /> {t(`load.${l}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
