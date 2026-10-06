/**
 * Écran d'accueil (premier lancement) : 4 étapes, puis le choix entre la démo et un cabinet vide.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PRACTICE_AREAS } from '@shared/domain/firm';
import type { Jurisdiction } from '@shared/types';
import type { Derived } from '../store/useDerived';
import { useFirm } from '../store/useFirm';
import { Icon } from './primitives';
import { JurisdictionPicker } from './JurisdictionPicker';
import { dollarsToCents, fromDraft, inputClass, StaffFields, toDraft } from './StaffForm';

interface Step {
  title: string;
  body: string;
  points: string[];
}

const STEP_ICONS = ['🔒', '🚨', '⏱️', '⚖️'];

export function Onboarding({ derived }: { derived: Derived }) {
  const { t } = useTranslation();
  const startWithDemo = useFirm((s) => s.startWithDemo);
  const steps = t('onboarding.steps', { returnObjects: true }) as Step[];
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'choice' | 'create'>('choice');

  const { settings } = derived.snapshot;
  if (settings.onboarded) return null;
  const onChoice = index >= steps.length;
  const step = steps[Math.min(index, steps.length - 1)];


  return (
    <div className="pointer-events-auto absolute inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="CaseForge">
      <div className="animate-panel w-[min(720px,100%)] overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-[#3b5bdb] to-[#5b7cfa] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 text-lg font-black">C</div>
            <div>
              <div className="text-base font-extrabold">CaseForge</div>
              <div className="text-xs opacity-80">{t('app.tagline')}</div>
            </div>
          </div>
          {!onChoice && (
            <button type="button" onClick={() => setIndex(steps.length)} className="text-xs font-semibold opacity-80 hover:opacity-100">
              {t('onboarding.skip')}
            </button>
          )}
        </div>

        {!onChoice ? (
          <div className="px-8 py-7">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {t('onboarding.step', { n: index + 1, total: steps.length })}
            </div>
            <div key={index} className="animate-panel">
              <h2 className="mt-2 flex items-center gap-3 text-2xl font-extrabold tracking-tight">
                <span className="text-3xl" aria-hidden>{STEP_ICONS[index]}</span> {step.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.body}</p>
              <ul className="mt-4 space-y-1.5">
                {step.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-600"><Icon.check /></span> {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-7 flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={t('onboarding.step', { n: i + 1, total: steps.length })}
                    onClick={() => setIndex(i)}
                    className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-[var(--color-brand)]' : 'w-2 bg-slate-300'}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {index > 0 && (
                  <button type="button" onClick={() => setIndex(index - 1)} className="h-10 rounded-xl px-4 text-sm font-semibold text-[var(--color-muted)] hover:bg-slate-100">
                    {t('onboarding.back')}
                  </button>
                )}
                <button type="button" onClick={() => setIndex(index + 1)} className="h-10 rounded-xl bg-[var(--color-brand)] px-5 text-sm font-bold text-white shadow active:scale-95">
                  {t('onboarding.next')}
                </button>
              </div>
            </div>
          </div>
        ) : mode === 'choice' ? (
          <div className="px-8 py-7">
            <h2 className="text-2xl font-extrabold tracking-tight">{t('onboarding.choiceTitle')}</h2>
            {settings.demo ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => void startWithDemo()}
                  className="rounded-2xl bg-[var(--color-brand)] p-5 text-left text-white shadow-lg transition hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <div className="text-lg font-extrabold">▶ {t('onboarding.startDemo')}</div>
                  <div className="mt-1 text-xs opacity-90">{t('onboarding.startDemoHint')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className="rounded-2xl border-2 border-[var(--color-line)] p-5 text-left transition hover:border-[var(--color-brand)]"
                >
                  <div className="text-lg font-extrabold">＋ {t('onboarding.startEmpty')}</div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">{t('onboarding.startEmptyHint')}</div>
                </button>
              </div>
            ) : (
              // Cabinet réel : l'accueil ne propose aucune action destructrice.
              <button
                type="button"
                autoFocus
                onClick={() => void startWithDemo()}
                className="mt-5 w-full rounded-2xl bg-[var(--color-brand)] p-5 text-left text-white shadow-lg"
              >
                <div className="text-lg font-extrabold">▶ {t('onboarding.continueWith', { firm: settings.firmName })}</div>
              </button>
            )}
            <button type="button" onClick={() => setIndex(steps.length - 1)} className="mt-5 text-xs font-semibold text-[var(--color-muted)] hover:underline">
              ← {t('onboarding.back')}
            </button>
          </div>
        ) : (
          <div className="px-8 py-7">
            <CreateFirmForm onCancel={() => setMode('choice')} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Création d'un cabinet vide (accueil, ou paramètres après confirmation). */
export function CreateFirmForm({ onCancel }: { onCancel?: () => void }) {
  const { t } = useTranslation();
  const createEmptyFirm = useFirm((s) => s.createEmptyFirm);
  const [firmName, setFirmName] = useState('');
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>(['QC']);
  const [owner, setOwner] = useState(toDraft({ role: 'associe' }, 30_000, DEFAULT_PRACTICE_AREAS[0].id));
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const input = fromDraft(owner);
        await createEmptyFirm({
          firmName,
          jurisdictions,
          defaultRateCents: dollarsToCents(owner.rate),
          owner: { name: input.name, initials: input.initials, role: input.role, hourlyRateCents: input.hourlyRateCents, targetHoursWeek: input.targetHoursWeek },
        });
        setBusy(false);
      }}
    >
      <h2 className="text-2xl font-extrabold tracking-tight">{t('onboarding.createTitle')}</h2>
      <label className="block text-[11px] text-[var(--color-muted)]">
        {t('settings.firmName')}
        <input autoFocus className={inputClass} value={firmName} onChange={(e) => setFirmName(e.target.value)} maxLength={120} placeholder="Tremblay Avocats s.e.n.c.r.l." />
      </label>
      <div>
        <div className="mb-1 text-[11px] text-[var(--color-muted)]">{t('settings.jurisdictions')}</div>
        <JurisdictionPicker value={jurisdictions} onChange={setJurisdictions} />
      </div>
      <div>
        <div className="mb-1 text-[11px] text-[var(--color-muted)]">{t('onboarding.yourName')}</div>
        <StaffFields draft={owner} onChange={setOwner} compact />
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">{t('settings.initialsNote')}</p>
      </div>
      <div className="flex items-center justify-between pt-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-xs font-semibold text-[var(--color-muted)] hover:underline">
            ← {t('onboarding.back')}
          </button>
        ) : <span />}
        <button type="submit" disabled={busy} className="h-10 rounded-xl bg-[var(--color-brand)] px-5 text-sm font-bold text-white shadow disabled:opacity-50">
          {t('onboarding.create')}
        </button>
      </div>
    </form>
  );
}
