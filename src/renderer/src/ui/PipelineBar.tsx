import { useTranslation } from 'react-i18next';
import { PIPELINE_STAGES } from '@shared/types';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { STAGE_COLORS } from '../scene/palette';
import { ALERT_COLORS, worstLevel } from '@shared/domain/alerts';

/** Barre de pipeline : nombre de dossiers par étape ; survol ou clic = filtre sur la carte. */
export function PipelineBar({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const stageFilter = useFirm((s) => s.stageFilter);
  const setStageFilter = useFirm((s) => s.setStageFilter);
  const active = derived.snapshot.matters.filter((m) => m.status !== 'ferme');

  return (
    <nav aria-label={t('pipelineBar.title')} className="glass pointer-events-auto absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-stretch gap-1 rounded-2xl p-1.5">
      {PIPELINE_STAGES.map((stage, i) => {
        const matters = active.filter((m) => m.stage === stage);
        const worst = worstLevel(matters.flatMap((m) => derived.alertsByMatter.get(m.id) ?? []));
        const on = stageFilter === stage;
        return (
          <button
            key={stage}
            type="button"
            onClick={() => setStageFilter(on ? null : stage)}
            className={`relative flex min-w-[84px] flex-col items-center rounded-xl px-2 py-1.5 transition ${on ? 'bg-white shadow-md' : 'hover:bg-white/60'}`}
          >
            <span className="h-1 w-8 rounded-full" style={{ background: STAGE_COLORS[i] }} />
            <span className="tabular mt-1 text-lg font-bold leading-none">{matters.length}</span>
            <span className="text-[10px] font-medium text-[var(--color-muted)]">{t(`stage.${stage}`)}</span>
            {(worst === 'critique' || worst === 'depasse') && (
              <span className="animate-alert absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: ALERT_COLORS[worst] }} />
            )}
            {i < PIPELINE_STAGES.length - 1 && <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-300">›</span>}
          </button>
        );
      })}
    </nav>
  );
}
