import { useTranslation } from 'react-i18next';
import { ALL_JURISDICTIONS } from '@shared/domain/firm';
import { calendarStatus } from '@shared/domain/calendar';
import type { Jurisdiction } from '@shared/types';

/** Choix des ressorts, avec l'état de validation du calendrier judiciaire de chacun. */
export function JurisdictionPicker({ value, onChange }: { value: Jurisdiction[]; onChange: (v: Jurisdiction[]) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_JURISDICTIONS.map((j) => {
        const on = value.includes(j);
        const status = calendarStatus(j);
        return (
          <button
            key={j}
            type="button"
            aria-pressed={on}
            title={t(`calendar.${status}`)}
            onClick={() => onChange(on ? value.filter((x) => x !== j) : [...value, j])}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              on ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-line)] bg-white text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {j}
            <span
              className={`h-1.5 w-1.5 rounded-full ${status === 'valide' ? 'bg-emerald-400' : status === 'a_valider' ? 'bg-amber-400' : 'bg-slate-300'}`}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
