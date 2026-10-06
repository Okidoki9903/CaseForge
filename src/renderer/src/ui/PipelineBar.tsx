import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PIPELINE_STAGES, type PipelineStage } from '@shared/types';
import { ALERT_COLORS, worstLevel } from '@shared/domain/alerts';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { STAGE_COLORS } from '../scene/palette';
import { MATTER_DND_TYPE } from '../lib/dnd';
import { Icon } from './primitives';

/**
 * Barre de pipeline : nombre de dossiers par étape.
 *  - clic = filtre rapide sur la carte (re-clic ou ✕ pour retirer) ;
 *  - déposer un dossier (glissé depuis son panneau) = changement d'étape journalisé.
 */
export function PipelineBar({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const stageFilter = useFirm((s) => s.stageFilter);
  const setStageFilter = useFirm((s) => s.setStageFilter);
  const setStage = useFirm((s) => s.setStage);
  const [dropTarget, setDropTarget] = useState<PipelineStage | null>(null);
  const active = derived.snapshot.matters.filter((m) => m.status !== 'ferme');

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
      {stageFilter && (
        <button
          type="button"
          onClick={() => setStageFilter(null)}
          className="glass pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
          title={t('pipelineBar.clear')}
        >
          {t('pipelineBar.filter', { stage: t(`stage.${stageFilter}`) })} <Icon.close />
        </button>
      )}
      <nav aria-label={t('pipelineBar.title')} className="glass pointer-events-auto flex items-stretch gap-1 rounded-2xl p-1.5">
        {PIPELINE_STAGES.map((stage, i) => {
          const matters = active.filter((m) => m.stage === stage);
          const worst = worstLevel(matters.flatMap((m) => derived.alertsByMatter.get(m.id) ?? []));
          const on = stageFilter === stage;
          const dropping = dropTarget === stage;
          return (
            <button
              key={stage}
              type="button"
              aria-pressed={on}
              title={dropping ? t('pipelineBar.drop', { stage: t(`stage.${stage}`) }) : t('pipelineBar.stageTitle', { stage: t(`stage.${stage}`) })}
              onClick={() => setStageFilter(on ? null : stage)}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(MATTER_DND_TYPE)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(stage);
              }}
              onDragLeave={() => setDropTarget((d) => (d === stage ? null : d))}
              onDrop={(e) => {
                const id = e.dataTransfer.getData(MATTER_DND_TYPE);
                setDropTarget(null);
                if (id) {
                  e.preventDefault();
                  void setStage(id, stage);
                }
              }}
              className={`relative flex min-w-[84px] flex-col items-center rounded-xl px-2 py-1.5 transition ${
                dropping ? 'scale-105 bg-white shadow-lg ring-2' : on ? 'bg-white shadow-md' : 'hover:bg-white/60'
              }`}
              style={dropping ? { ['--tw-ring-color' as string]: STAGE_COLORS[i] } : undefined}
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
    </div>
  );
}
